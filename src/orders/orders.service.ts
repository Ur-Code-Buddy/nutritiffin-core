import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { FoodItem } from '../food-items/entities/food-item.entity';
import { FoodItemAvailability } from '../food-items/entities/food-item-availability.entity';

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
  ) { }

  async create(clientId: string, dto: CreateOrderDto) {
    // 1. Validate "1-3 Days in Advance"
    const now = new Date();
    const minDate = new Date(now);
    minDate.setDate(minDate.getDate() + 1);
    minDate.setHours(0, 0, 0, 0); // Start of tomorrow

    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() + 3);
    maxDate.setHours(23, 59, 59, 999); // End of 3rd day

    const scheduledDate = new Date(dto.scheduled_for);
    const comparisonDate = new Date(scheduledDate);
    comparisonDate.setHours(0, 0, 0, 0);

    if (comparisonDate < minDate || comparisonDate > maxDate) {
      throw new BadRequestException(
        'Orders must be placed for 1 to 3 days in advance.',
      );
    }

    const queryRunner = this.ordersRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Validate Items & Availability
      const orderItems: OrderItem[] = [];
      let totalPrice = 0;

      // To avoid deadlocks, sort items by food_item_id
      const sortedItems = [...dto.items].sort((a, b) => a.food_item_id.localeCompare(b.food_item_id));

      for (const itemDto of sortedItems) {
        // Use pessimistic write lock to serialize concurrent capacity checks
        const foodItem = await queryRunner.manager.findOne(FoodItem, {
          where: { id: itemDto.food_item_id, kitchen_id: dto.kitchen_id },
          relations: ['availability'],
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

        // Check specific availability
        const availability = foodItem.availability?.find(
          (a) => a.date === dto.scheduled_for,
        );
        if (availability && !availability.is_available) {
          throw new BadRequestException(
            `${foodItem.name} is unavailable for ${dto.scheduled_for}.`,
          );
        }

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
      const platformFees = Number(this.configService.get<number>('PLATFORM_FEES', 10));
      const deliveryFees = Number(this.configService.get<number>('DELIVERY_FEES', 20));
      const kitchenFeesPercent = Number(this.configService.get<number>('KITCHEN_FEES', 15));

      const kitchenFees = parseFloat(((kitchenFeesPercent / 100) * totalPrice).toFixed(2));
      const grandTotal = parseFloat((totalPrice + platformFees + deliveryFees).toFixed(2));

      // 4. Create Order
      const order = queryRunner.manager.create(Order, {
        client_id: clientId,
        kitchen_id: dto.kitchen_id,
        scheduled_for: dto.scheduled_for,
        status: OrderStatus.PENDING,
        items: orderItems,
        total_price: grandTotal,
        platform_fees: platformFees,
        delivery_fees: deliveryFees,
        kitchen_fees: kitchenFees,
      });

      const savedOrder = await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();

      // 5. Trigger Auto-Reject Job (10 mins)
      await this.ordersQueue.add(
        'order-timeout',
        { orderId: savedOrder.id },
        { delay: 10 * 60 * 1000, jobId: `timeout-${savedOrder.id}` },
      );

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
        throw new BadRequestException('Order status cannot be conditionally changed unless PENDING.');
      }
    } else if (status === OrderStatus.READY) {
      if (order.status !== OrderStatus.ACCEPTED) {
        throw new BadRequestException('Order must be ACCEPTED before it can be marked as READY.');
      }
    }

    order.status = status;

    if (status === OrderStatus.ACCEPTED) {
      order.accepted_at = new Date();
    } else if (status === OrderStatus.READY) {
      order.ready_at = new Date();
    }

    return this.ordersRepo.save(order);
  }
}
