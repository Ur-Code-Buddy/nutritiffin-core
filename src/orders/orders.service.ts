import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  Order,
  OrderStatus,
  PaymentStatus,
  RefundStatus,
} from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { FoodItem } from '../food-items/entities/food-item.entity';
import { FoodItemAvailability } from '../food-items/entities/food-item-availability.entity';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Kitchen } from '../kitchens/entities/kitchen.entity';
import { PaymentsService } from './payments.service';
import { addBusinessDays, toDateOnlyString } from '../common/utils/business-days';

export interface RazorpayPaymentMeta {
  razorpayOrderId: string;
  razorpayPaymentId: string;
}

export interface OrderQuote {
  orderItems: OrderItem[];
  totalPrice: number;
  platformFees: number;
  deliveryFees: number;
  kitchenFees: number;
  taxFees: number;
  grandTotal: number;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepo: Repository<OrderItem>,
    @InjectRepository(FoodItem)
    private foodItemRepo: Repository<FoodItem>,
    @InjectQueue('orders')
    private ordersQueue: Queue,
    private configService: ConfigService,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}

  private readonly logger = new Logger(OrdersService.name);

  private validateScheduledFor(scheduledFor: string) {
    // 1. Validate "1-3 Days in Advance"
    const now = new Date();
    const minDate = new Date(now);
    minDate.setDate(minDate.getDate() + 1);
    minDate.setHours(0, 0, 0, 0); // Start of tomorrow

    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() + 3);
    maxDate.setHours(23, 59, 59, 999); // End of 3rd day

    const scheduledDate = new Date(scheduledFor);
    const comparisonDate = new Date(scheduledDate);
    comparisonDate.setHours(0, 0, 0, 0);

    if (comparisonDate < minDate || comparisonDate > maxDate) {
      throw new BadRequestException(
        'Orders must be placed for 1 to 3 days in advance.',
      );
    }
  }

  private async buildOrderQuote(
    dto: CreateOrderDto,
    queryRunner: QueryRunner,
  ): Promise<OrderQuote> {
    // 2. Validate Items & Availability + build order line snapshots
    const orderItems: OrderItem[] = [];
    let totalPrice = 0;

    // To avoid deadlocks, sort items by food_item_id
    const sortedItems = [...dto.items].sort((a, b) =>
      a.food_item_id.localeCompare(b.food_item_id),
    );

    for (const itemDto of sortedItems) {
      // Use pessimistic write lock on the food item row only
      const foodItem = await queryRunner.manager.findOne(FoodItem, {
        where: { id: itemDto.food_item_id, kitchen_id: dto.kitchen_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!foodItem) {
        throw new BadRequestException(
          `Food item ${itemDto.food_item_id} not found or not from this kitchen.`,
        );
      }

      if (!foodItem.active) {
        throw new BadRequestException(`${foodItem.name} is inactive.`);
      }

      // Check specific availability (if an override exists for that date)
      const availability = await queryRunner.manager.findOne(
        FoodItemAvailability,
        {
          where: {
            food_item_id: foodItem.id,
            date: dto.scheduled_for,
          },
        },
      );
      if (availability && !availability.is_available) {
        throw new BadRequestException(
          `${foodItem.name} is unavailable for ${dto.scheduled_for}.`,
        );
      }

      // Sold-out check (excluding REJECTED orders)
      const sold = await queryRunner.manager
        .createQueryBuilder(OrderItem, 'oi')
        .leftJoin('oi.order', 'o')
        .where('oi.food_item_id = :itemId', { itemId: foodItem.id })
        .andWhere('o.scheduled_for = :date', { date: dto.scheduled_for })
        .andWhere('o.status != :status', { status: OrderStatus.REJECTED })
        .select('SUM(oi.quantity)', 'sum')
        .getRawOne();

      const currentSold = parseInt(sold?.sum || '0', 10);
      if (currentSold + itemDto.quantity > foodItem.max_daily_orders) {
        throw new BadRequestException(
          `${foodItem.name} sold out for ${dto.scheduled_for}.`,
        );
      }

      const orderItem = new OrderItem();
      orderItem.food_item = foodItem;
      orderItem.quantity = itemDto.quantity;
      orderItem.snapshot_price = foodItem.price;
      orderItems.push(orderItem);
      totalPrice += Number(foodItem.price) * itemDto.quantity;
    }

    // 3. Calculate Fees
    const platformFees = Number(
      this.configService.get<number>('PLATFORM_FEES', 10),
    );
    const deliveryFees = Number(
      this.configService.get<number>('DELIVERY_FEES', 20),
    );
    const kitchenFeesPercent = Number(
      this.configService.get<number>('KITCHEN_FEES', 15),
    );
    const taxPercent = Number(this.configService.get<number>('TAX_PERCENT', 5));

    const kitchenFees = parseFloat(
      ((kitchenFeesPercent / 100) * totalPrice).toFixed(2),
    );
    const taxFees = parseFloat(((taxPercent / 100) * totalPrice).toFixed(2));
    const grandTotal = parseFloat(
      (totalPrice + platformFees + deliveryFees + taxFees).toFixed(2),
    );

    return {
      orderItems,
      totalPrice,
      platformFees,
      deliveryFees,
      kitchenFees,
      taxFees,
      grandTotal,
    };
  }

  /**
   * Calculates the order total after running the full validation suite (date, availability, sold-out, fee calc)
   * but WITHOUT saving an Order row.
   */
  async calculateOrderQuote(dto: CreateOrderDto): Promise<OrderQuote> {
    this.validateScheduledFor(dto.scheduled_for);

    const queryRunner = this.ordersRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const quote = await this.buildOrderQuote(dto, queryRunner);
      await queryRunner.commitTransaction();
      return quote;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async create(
    clientId: string,
    dto: CreateOrderDto,
    paymentMeta?: RazorpayPaymentMeta,
  ) {
    this.validateScheduledFor(dto.scheduled_for);

    const queryRunner = this.ordersRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const quote = await this.buildOrderQuote(dto, queryRunner);

      const kitchenRow = await queryRunner.manager.findOne(Kitchen, {
        where: { id: dto.kitchen_id },
      });
      if (!kitchenRow) {
        throw new BadRequestException('Kitchen not found');
      }
      const autoAccept = Boolean(kitchenRow.auto_accept_orders);

      // Idempotency guard: if the same razorpay payment is confirmed again,
      // just return the existing order instead of creating duplicates.
      if (paymentMeta?.razorpayPaymentId) {
        const existing = await queryRunner.manager.findOne(Order, {
          where: { razorpayPaymentId: paymentMeta.razorpayPaymentId },
        });
        if (existing) {
          await queryRunner.commitTransaction();
          return existing;
        }
      }

      // 4. Create Order (ACCEPTED immediately when kitchen has auto_accept_orders)
      const order = queryRunner.manager.create(Order, {
        client_id: clientId,
        kitchen_id: dto.kitchen_id,
        scheduled_for: dto.scheduled_for,
        status: autoAccept ? OrderStatus.ACCEPTED : OrderStatus.PENDING,
        ...(autoAccept ? { accepted_at: new Date() } : {}),
        items: quote.orderItems,
        total_price: quote.grandTotal,
        platform_fees: quote.platformFees,
        delivery_fees: quote.deliveryFees,
        kitchen_fees: quote.kitchenFees,
        tax_fees: quote.taxFees,
        paymentStatus: paymentMeta ? PaymentStatus.PAID : PaymentStatus.PENDING,
        razorpayOrderId: paymentMeta?.razorpayOrderId ?? null,
        razorpayPaymentId: paymentMeta?.razorpayPaymentId ?? null,
      });

      const savedOrder = await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();

      // Notify kitchen owner (wording reflects auto-accept)
      try {
        const kitchenOwner = await this.usersService.findOneById(
          kitchenRow.owner_id,
        );
        if (kitchenOwner?.fcm_token) {
          this.notificationsService.sendPushNotification(
            kitchenOwner.fcm_token,
            'New Order Received!',
            autoAccept
              ? 'A new order was placed and automatically accepted.'
              : 'A new order was placed. Please check your dashboard.',
            { orderId: savedOrder.id },
          );
        }
      } catch (notifErr) {
        this.logger.error('Failed to send push notification', notifErr);
      }

      if (autoAccept) {
        await this.notifyClientOrderAcceptedOrReady(
          savedOrder,
          OrderStatus.ACCEPTED,
        );
      }

      // 5. Pending orders only: auto-reject if kitchen does not respond in time
      if (!autoAccept) {
        try {
          await this.ordersQueue.add(
            'order-timeout',
            { orderId: savedOrder.id },
            { delay: 10 * 60 * 1000, jobId: `timeout-${savedOrder.id}` },
          );
        } catch (queueErr) {
          this.logger.error(
            `Failed to enqueue order-timeout job for order ${savedOrder.id}: ${queueErr?.message ?? queueErr}`,
          );
        }
      }

      return savedOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  findAll(userId: string, role: string) {
    if (role === 'KITCHEN_OWNER') {
      // Find kitchen owned by user first (omitted for brevity, assume passed logic handles it or we join)
      // For simplicity: filtering logic should be robust
      return this.ordersRepo.find({
        where: { kitchen: { owner_id: userId } },
        relations: ['items', 'items.food_item', 'client'],
      });
    }
    return this.ordersRepo.find({
      where: { client_id: userId },
      relations: ['items', 'items.food_item', 'kitchen'],
    });
  }

  async findOne(id: string) {
    return this.ordersRepo.findOne({
      where: { id },
      relations: ['items', 'items.food_item', 'delivery_driver'],
    });
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.findOne(id);
    if (!order) throw new NotFoundException('Order not found');

    if (status === OrderStatus.ACCEPTED || status === OrderStatus.REJECTED) {
      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          'Order status cannot be conditionally changed unless PENDING.',
        );
      }
    } else if (status === OrderStatus.READY) {
      if (order.status !== OrderStatus.ACCEPTED) {
        throw new BadRequestException(
          'Order must be ACCEPTED before it can be marked as READY.',
        );
      }
    }

    order.status = status;

    if (status === OrderStatus.ACCEPTED) {
      order.accepted_at = new Date();
    } else if (status === OrderStatus.READY) {
      order.ready_at = new Date();
    }

    const savedOrder = await this.ordersRepo.save(order);

    if (status === OrderStatus.REJECTED) {
      return this.onOrderRejected(savedOrder);
    }

    await this.notifyClientOrderAcceptedOrReady(savedOrder, status);

    return savedOrder;
  }

  private async notifyClientOrderAcceptedOrReady(
    order: Order,
    status: OrderStatus,
  ): Promise<void> {
    if (status !== OrderStatus.ACCEPTED && status !== OrderStatus.READY) {
      return;
    }
    try {
      const client = await this.usersService.findOneById(order.client_id);
      if (!client?.fcm_token) {
        return;
      }
      let title = '';
      let body = '';
      if (status === OrderStatus.ACCEPTED) {
        title = 'Order Accepted!';
        body = 'Your order has been accepted and is being prepared.';
      } else if (status === OrderStatus.READY) {
        title = 'Order Ready for Pickup!';
        body = 'Your order is ready and waiting for a delivery driver.';
      }
      if (title && body) {
        await this.notificationsService.sendPushNotification(
          client.fcm_token,
          title,
          body,
          { orderId: order.id },
        );
      }
    } catch (notifErr) {
      this.logger.error('Failed to send push notification to client', notifErr);
    }
  }

  /**
   * Auto-reject from Bull timeout job — same refund + notification path as kitchen reject.
   */
  async rejectPendingOrderByTimeout(orderId: string): Promise<void> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order || order.status !== OrderStatus.PENDING) {
      return;
    }
    order.status = OrderStatus.REJECTED;
    const saved = await this.ordersRepo.save(order);
    await this.onOrderRejected(saved);
  }

  private async onOrderRejected(order: Order): Promise<Order> {
    const isPaid =
      order.paymentStatus === PaymentStatus.PAID && !!order.razorpayPaymentId;

    if (!isPaid) {
      if (order.refund_status !== RefundStatus.NOT_APPLICABLE) {
        order.refund_status = RefundStatus.NOT_APPLICABLE;
        order.razorpay_refund_id = null;
        order.refund_initiated_at = null;
        order.refund_expected_by = null;
        await this.ordersRepo.save(order);
      }
      await this.notifyClientOrderRejected(order, 'unpaid');
      return (await this.findOne(order.id)) ?? order;
    }

    const refundResult =
      await this.paymentsService.refundCapturedPaymentForOrder(order);

    if (refundResult.type === 'already_recorded') {
      await this.notifyClientOrderRejected(order, 'refund_pending');
      return (await this.findOne(order.id)) ?? order;
    }

    if (
      refundResult.type === 'success' ||
      refundResult.type === 'already_refunded'
    ) {
      const initiatedAt = new Date();
      order.refund_status = RefundStatus.PENDING;
      order.razorpay_refund_id = refundResult.refundId;
      order.refund_initiated_at = initiatedAt;
      order.refund_expected_by = toDateOnlyString(
        addBusinessDays(initiatedAt, 7),
      );
      await this.ordersRepo.save(order);
      await this.notifyClientOrderRejected(order, 'refund_initiated');
      return (await this.findOne(order.id)) ?? order;
    }

    order.refund_status = RefundStatus.FAILED;
    await this.ordersRepo.save(order);
    await this.notifyClientOrderRejected(order, 'refund_failed');
    return (await this.findOne(order.id)) ?? order;
  }

  private async notifyClientOrderRejected(
    order: Order,
    kind: 'unpaid' | 'refund_initiated' | 'refund_pending' | 'refund_failed',
  ): Promise<void> {
    try {
      const client = await this.usersService.findOneById(order.client_id);
      if (!client?.fcm_token) {
        return;
      }

      const title = 'Order Rejected';
      let body: string;
      switch (kind) {
        case 'unpaid':
          body =
            'Unfortunately, your order was rejected by the kitchen.';
          break;
        case 'refund_initiated':
        case 'refund_pending':
          body =
            'Your order was rejected. Your refund has been initiated and should appear within 5–7 business days.';
          break;
        case 'refund_failed':
          body =
            'Your order was rejected. We could not process your refund automatically — support will contact you shortly.';
          break;
      }

      const latest = await this.findOne(order.id);
      const refundStatus = latest?.refund_status ?? order.refund_status;
      const refundExpectedBy = latest?.refund_expected_by ?? '';

      await this.notificationsService.sendPushNotification(
        client.fcm_token,
        title,
        body,
        {
          orderId: order.id,
          refundStatus: String(refundStatus),
          refundExpectedBy: refundExpectedBy ?? '',
        },
      );
    } catch (notifErr) {
      this.logger.error('Failed to send push notification to client', notifErr);
    }
  }
}
