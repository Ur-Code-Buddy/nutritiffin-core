import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
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
        status: OrderStatus.ACCEPTED,
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
    const order = await this.findOne(id);

    if (order.status !== OrderStatus.ACCEPTED) {
      throw new BadRequestException('Order is not available for pickup');
    }

    if (order.delivery_driver_id) {
      throw new BadRequestException('Order already accepted by another driver');
    }

    order.delivery_driver_id = driverId;
    return this.ordersRepository.save(order);
  }

  async pickUpDelivery(id: string, driverId: string) {
    const order = await this.findOne(id);

    if (order.delivery_driver_id !== driverId) {
      throw new BadRequestException('You are not the driver for this order');
    }

    if (order.status !== OrderStatus.ACCEPTED) {
      throw new BadRequestException('Order cannot be picked up from current status');
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
      throw new BadRequestException('Order must be picked up before going out for delivery');
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
