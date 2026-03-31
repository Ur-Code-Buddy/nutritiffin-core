import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewsRepo: Repository<Review>,
    @InjectRepository(OrderItem)
    private orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
  ) {}

  /**
   * Stars for each order line the client has rated, for the given orders (order_item_id → stars).
   */
  async getItemStarsMapForOrders(
    clientId: string,
    orderIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (orderIds.length === 0) {
      return map;
    }
    const rows = await this.reviewsRepo.find({
      where: { client_id: clientId, order_id: In(orderIds) },
      select: ['order_item_id', 'stars'],
    });
    for (const r of rows) {
      map.set(r.order_item_id, r.stars);
    }
    return map;
  }

  async upsertOrderItemRating(
    clientId: string,
    orderId: string,
    orderItemId: string,
    stars: number,
  ): Promise<Review> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.client_id !== clientId) {
      throw new BadRequestException('This order does not belong to you');
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'You can only rate items from delivered orders',
      );
    }

    const orderItem = await this.orderItemRepo.findOne({
      where: { id: orderItemId, order: { id: orderId } },
      relations: ['order'],
    });
    if (!orderItem || orderItem.order.id !== orderId) {
      throw new NotFoundException('Order item not found on this order');
    }

    let review = await this.reviewsRepo.findOne({
      where: { client_id: clientId, order_item_id: orderItemId },
    });

    if (review) {
      review.stars = stars;
      return this.reviewsRepo.save(review);
    }

    review = this.reviewsRepo.create({
      client_id: clientId,
      kitchen_id: order.kitchen_id,
      food_item_id: orderItem.food_item_id,
      order_id: order.id,
      order_item_id: orderItem.id,
      stars,
    });
    return this.reviewsRepo.save(review);
  }

  async findByFoodItem(foodItemId: string) {
    return this.reviewsRepo.find({
      where: { food_item_id: foodItemId },
      order: { created_at: 'DESC' },
    });
  }

  async findByKitchen(kitchenId: string) {
    return this.reviewsRepo.find({
      where: { kitchen_id: kitchenId },
      order: { created_at: 'DESC' },
    });
  }

  async findMyReviews(clientId: string) {
    return this.reviewsRepo.find({
      where: { client_id: clientId },
      relations: ['food_item'],
      order: { created_at: 'DESC' },
    });
  }
}
