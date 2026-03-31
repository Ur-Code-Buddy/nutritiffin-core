import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { Review } from './entities/review.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewsRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let orderItemRepo: { findOne: jest.Mock };
  let ordersRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    reviewsRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve(x)),
    };
    orderItemRepo = { findOne: jest.fn() };
    ordersRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(Review), useValue: reviewsRepo },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemRepo },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
      ],
    }).compile();

    service = module.get(ReviewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getItemStarsMapForOrders', () => {
    it('returns empty map when no order ids', async () => {
      const m = await service.getItemStarsMapForOrders('c1', []);
      expect(m.size).toBe(0);
      expect(reviewsRepo.find).not.toHaveBeenCalled();
    });

    it('maps order_item_id to stars', async () => {
      reviewsRepo.find.mockResolvedValue([
        { order_item_id: 'oi1', stars: 4 },
        { order_item_id: 'oi2', stars: 5 },
      ]);
      const m = await service.getItemStarsMapForOrders('c1', ['o1']);
      expect(m.get('oi1')).toBe(4);
      expect(m.get('oi2')).toBe(5);
    });
  });

  describe('upsertOrderItemRating', () => {
    const order = {
      id: 'o1',
      client_id: 'c1',
      kitchen_id: 'k1',
      status: OrderStatus.DELIVERED,
    };
    const orderItem = {
      id: 'oi1',
      food_item_id: 'fi1',
      order: { id: 'o1' },
    };

    it('throws when order missing', async () => {
      ordersRepo.findOne.mockResolvedValue(null);
      await expect(
        service.upsertOrderItemRating('c1', 'o1', 'oi1', 5),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when wrong client', async () => {
      ordersRepo.findOne.mockResolvedValue({ ...order, client_id: 'other' });
      await expect(
        service.upsertOrderItemRating('c1', 'o1', 'oi1', 5),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when not delivered', async () => {
      ordersRepo.findOne.mockResolvedValue({
        ...order,
        status: OrderStatus.PENDING,
      });
      await expect(
        service.upsertOrderItemRating('c1', 'o1', 'oi1', 5),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates review when none exists', async () => {
      ordersRepo.findOne.mockResolvedValue(order);
      orderItemRepo.findOne.mockResolvedValue(orderItem);
      reviewsRepo.findOne.mockResolvedValue(null);

      await service.upsertOrderItemRating('c1', 'o1', 'oi1', 3);

      expect(reviewsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: 'c1',
          order_item_id: 'oi1',
          stars: 3,
          kitchen_id: 'k1',
          food_item_id: 'fi1',
          order_id: 'o1',
        }),
      );
      expect(reviewsRepo.save).toHaveBeenCalled();
    });

    it('updates stars when review exists', async () => {
      ordersRepo.findOne.mockResolvedValue(order);
      orderItemRepo.findOne.mockResolvedValue(orderItem);
      const existing = {
        id: 'r1',
        stars: 2,
        client_id: 'c1',
        order_item_id: 'oi1',
      };
      reviewsRepo.findOne.mockResolvedValue(existing);

      await service.upsertOrderItemRating('c1', 'o1', 'oi1', 5);

      expect(reviewsRepo.create).not.toHaveBeenCalled();
      expect(reviewsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'r1', stars: 5 }),
      );
    });
  });
});
