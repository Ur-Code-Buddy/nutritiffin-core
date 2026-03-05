import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) { }

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
      relations: ['kitchen', 'client', 'items', 'items.food_item'],
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  async acceptDelivery(id: string, driverId: string) {
    const queryRunner = this.ordersRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id },
        relations: ['kitchen', 'client', 'items', 'items.food_item'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      if (order.status !== OrderStatus.ACCEPTED && order.status !== OrderStatus.READY) {
        throw new BadRequestException('Order is not available for pickup');
      }

      if (order.delivery_driver_id) {
        throw new BadRequestException('Order already accepted by another driver');
      }

      order.delivery_driver_id = driverId;
      const savedOrder = await queryRunner.manager.save(order);
      await queryRunner.commitTransaction();
      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to accept delivery: ' + (error.message || 'Concurrent mod'));
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

    return this.ordersRepository.save(order);
  }

  async outForDelivery(id: string, driverId: string) {
    const order = await this.findOne(id);

    if (order.delivery_driver_id !== driverId) {
      throw new BadRequestException('You are not the driver for this order');
    }

    if (order.status !== OrderStatus.PICKED_UP) {
      throw new BadRequestException('Order must be PICKED_UP before going out for delivery');
    }

    order.status = OrderStatus.OUT_FOR_DELIVERY;

    return this.ordersRepository.save(order);
  }

  async finishDelivery(id: string, driverId: string) {
    const order = await this.findOne(id);

    if (order.delivery_driver_id !== driverId) {
      throw new BadRequestException('You are not the driver for this order');
    }

    if (order.status !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException('Order is not out for delivery');
    }

    order.status = OrderStatus.DELIVERED;
    order.delivered_at = new Date();

    return this.ordersRepository.save(order);
  }
}
