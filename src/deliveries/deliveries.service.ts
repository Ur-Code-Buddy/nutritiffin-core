import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Kitchen } from '../kitchens/entities/kitchen.entity';
import { User } from '../users/entities/user.entity';
import {
  Transaction,
  TransactionType,
  TransactionSource,
} from '../transactions/entities/transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  async findAllAvailable() {
    const orders = await this.ordersRepository.find({
      where: {
        status: In([OrderStatus.ACCEPTED, OrderStatus.READY]),
        delivery_driver: IsNull(),
      },
      relations: ['kitchen', 'kitchen.owner', 'items', 'items.food_item'],
      order: {
        created_at: 'ASC',
      },
      select: {
        id: true,
        status: true,
        total_price: true,
        created_at: true,
        scheduled_for: true,
        kitchen: {
          id: true,
          name: true,
          details: {
            address: true,
            phone: true,
          },
        },
      },
    });
    return orders;
  }

  async findMyOrders(driverId: string) {
    return this.ordersRepository.find({
      where: {
        delivery_driver_id: driverId,
      },
      relations: ['kitchen', 'client'],
      order: {
        updated_at: 'DESC',
      },
    });
  }

  async findOne(id: string) {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: [
        'kitchen',
        'client',
        'items',
        'items.food_item',
        'delivery_driver',
      ],
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  async acceptDelivery(id: string, driverId: string) {
    const queryRunner =
      this.ordersRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock only the order row itself to avoid FOR UPDATE on outer joins
      const order = await queryRunner.manager.findOne(Order, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      if (
        order.status !== OrderStatus.ACCEPTED &&
        order.status !== OrderStatus.READY
      ) {
        throw new BadRequestException('Order is not available for pickup');
      }

      if (order.delivery_driver_id) {
        throw new BadRequestException(
          'Order already accepted by another driver',
        );
      }

      order.delivery_driver_id = driverId;
      const savedOrder = await queryRunner.manager.save(order);
      await queryRunner.commitTransaction();
      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to accept delivery: ' + (error.message || 'Concurrent mod'),
      );
    } finally {
      await queryRunner.release();
    }
  }

  async pickUpDelivery(id: string, driverId: string) {
    const order = await this.findOne(id);

    if (order.delivery_driver_id !== driverId) {
      throw new BadRequestException('You are not the driver for this order');
    }

    if (order.status !== OrderStatus.READY) {
      throw new BadRequestException('Order can only be picked up when READY');
    }

    order.status = OrderStatus.PICKED_UP;
    order.picked_up_at = new Date();

    const savedOrder = await this.ordersRepository.save(order);

    if (order.client && order.client.fcm_token) {
      this.notificationsService
        .sendPushNotification(
          order.client.fcm_token,
          'Order Picked Up!',
          'Your order has been picked up and is on its way.',
          { orderId: order.id },
        )
        .catch((err) => this.logger.error('Push notification failed', err));
    }

    return savedOrder;
  }

  async outForDelivery(id: string, driverId: string) {
    const order = await this.findOne(id);

    if (order.delivery_driver_id !== driverId) {
      throw new BadRequestException('You are not the driver for this order');
    }

    if (order.status !== OrderStatus.PICKED_UP) {
      throw new BadRequestException(
        'Order must be PICKED_UP before going out for delivery',
      );
    }

    order.status = OrderStatus.OUT_FOR_DELIVERY;

    const savedOrder = await this.ordersRepository.save(order);

    if (order.client && order.client.fcm_token) {
      this.notificationsService
        .sendPushNotification(
          order.client.fcm_token,
          'Order Out for Delivery!',
          'Your driver is out for delivery with your order.',
          { orderId: order.id },
        )
        .catch((err) => this.logger.error('Push notification failed', err));
    }

    return savedOrder;
  }

  async finishDelivery(id: string, driverId: string) {
    const order = await this.findOne(id);

    if (order.delivery_driver_id !== driverId) {
      throw new BadRequestException('You are not the driver for this order');
    }

    if (order.status !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException('Order is not out for delivery');
    }

    const queryRunner =
      this.ordersRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    function generateShortId(): string {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `TXN-${result}`;
    }

    try {
      // Lock order row only — relations + pessimistic_write use LEFT JOIN + FOR UPDATE, which Postgres rejects
      const txOrder = await queryRunner.manager.findOne(Order, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!txOrder || txOrder.status !== OrderStatus.OUT_FOR_DELIVERY) {
        throw new BadRequestException('Order cannot be delivered now');
      }

      const kitchen = await queryRunner.manager.findOne(Kitchen, {
        where: { id: txOrder.kitchen_id },
      });

      const clientForPush = await queryRunner.manager.findOne(User, {
        where: { id: txOrder.client_id },
      });

      const driver = await queryRunner.manager.findOne(User, {
        where: { id: driverId },
        lock: { mode: 'pessimistic_write' },
      });

      const kitchenOwnerId = kitchen?.owner_id;
      const kitchenOwner = kitchenOwnerId
        ? await queryRunner.manager.findOne(User, {
            where: { id: kitchenOwnerId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;

      txOrder.status = OrderStatus.DELIVERED;
      txOrder.delivered_at = new Date();
      await queryRunner.manager.save(txOrder);

      // 1. Driver wallet: running total of cash collected from customers (order total_price includes
      //    food, platform, delivery, tax — delivery_fees is not tracked separately for the driver).
      if (driver) {
        driver.credits = Number(driver.credits) + Number(txOrder.total_price);
        await queryRunner.manager.save(driver);

        const collectionTxn = queryRunner.manager.create(Transaction, {
          short_id: generateShortId(),
          from_user_id: null,
          to_user_id: driver.id,
          amount: Number(txOrder.total_price),
          type: TransactionType.CREDIT,
          source: TransactionSource.DELIVERY,
          description: `Cash collected for order ID ${id.substring(0, 8)}`,
          reference_id: id,
        });
        await queryRunner.manager.save(collectionTxn);
      }

      // 2. Kitchen owner gets item cost minus kitchen commission
      if (kitchenOwner) {
        const itemTotal =
          Number(txOrder.total_price) -
          Number(txOrder.platform_fees) -
          Number(txOrder.delivery_fees) -
          Number(txOrder.tax_fees || 0);

        const kitchenEarnings = itemTotal - Number(txOrder.kitchen_fees);

        kitchenOwner.credits = Number(kitchenOwner.credits) + kitchenEarnings;
        await queryRunner.manager.save(kitchenOwner);

        const payoutTxn = queryRunner.manager.create(Transaction, {
          short_id: generateShortId(),
          from_user_id: null,
          to_user_id: kitchenOwner.id,
          amount: kitchenEarnings,
          type: TransactionType.CREDIT,
          source: TransactionSource.DELIVERY,
          description: `Kitchen payout for order ID ${id.substring(0, 8)}`,
          reference_id: id,
        });
        await queryRunner.manager.save(payoutTxn);
      }

      await queryRunner.commitTransaction();

      if (clientForPush?.fcm_token) {
        this.notificationsService
          .sendPushNotification(
            clientForPush.fcm_token,
            'Order Delivered!',
            'Your order has been delivered successfully. Enjoy your meal!',
            { orderId: txOrder.id },
          )
          .catch((err) => this.logger.error('Push notification failed', err));
      }

      if (clientForPush) {
        txOrder.client = clientForPush;
      }
      return txOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to finish delivery: ' + (error.message || 'Concurrent mod'),
      );
    } finally {
      await queryRunner.release();
    }
  }
}
