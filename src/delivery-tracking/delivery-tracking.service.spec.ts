import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryTrackingService } from './delivery-tracking.service';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { UserRole } from '../users/user.role.enum';
import { RedisService } from '../redis/redis.service';
import { GoogleRoutesService } from './google-routes.service';
import { GoogleGeocodingService } from './google-geocoding.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('DeliveryTrackingService', () => {
  let service: DeliveryTrackingService;
  let ordersFindOne: jest.Mock;
  let redisGet: jest.Mock;
  let redisSetex: jest.Mock;
  let redisSet: jest.Mock;
  let computeRoute: jest.Mock;
  let getApiKey: jest.Mock;
  let resolveAddress: jest.Mock;
  let sendPush: jest.Mock;

  const driverId = 'driver-1';
  const clientId = 'client-1';
  const orderId = 'order-1';
  const kitchenId = 'kitchen-1';

  function baseOrder(over: Partial<Order> = {}): Order {
    return {
      id: orderId,
      client_id: clientId,
      kitchen_id: kitchenId,
      status: OrderStatus.OUT_FOR_DELIVERY,
      delivery_driver_id: driverId,
      kitchen: {
        id: kitchenId,
        name: 'Test Kitchen',
        latitude: '19.0000000',
        longitude: '72.8000000',
        details: { address: 'Addr', phone: '1', email: 'e@e.com' },
      } as any,
      client: {
        id: clientId,
        address: 'Home',
        pincode: '400001',
        latitude: '19.0100000',
        longitude: '72.8100000',
        fcm_token: null,
      } as any,
      ...over,
    } as Order;
  }

  beforeEach(async () => {
    ordersFindOne = jest.fn();
    redisGet = jest.fn();
    redisSetex = jest.fn().mockResolvedValue('OK');
    redisSet = jest.fn().mockResolvedValue(null);
    computeRoute = jest.fn();
    getApiKey = jest.fn().mockReturnValue('test-key');
    resolveAddress = jest.fn().mockResolvedValue(null);
    sendPush = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryTrackingService,
        {
          provide: getRepositoryToken(Order),
          useValue: { findOne: ordersFindOne },
        },
        {
          provide: RedisService,
          useValue: {
            client: {
              get: redisGet,
              setex: redisSetex,
              set: redisSet,
            },
          },
        },
        {
          provide: GoogleRoutesService,
          useValue: {
            getApiKey,
            computeRoute,
          },
        },
        {
          provide: GoogleGeocodingService,
          useValue: { resolveAddress },
        },
        {
          provide: NotificationsService,
          useValue: { sendPushNotification: sendPush },
        },
      ],
    }).compile();

    service = module.get(DeliveryTrackingService);
  });

  describe('updateDriverLocation', () => {
    it('throws NotFoundException when order missing', async () => {
      ordersFindOne.mockResolvedValue(null);
      await expect(
        service.updateDriverLocation(orderId, driverId, {
          lat: 19,
          lng: 72,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not assigned driver', async () => {
      ordersFindOne.mockResolvedValue(baseOrder());
      await expect(
        service.updateDriverLocation(orderId, 'other', { lat: 19, lng: 72 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when status not allowed', async () => {
      ordersFindOne.mockResolvedValue(
        baseOrder({ status: OrderStatus.DELIVERED }),
      );
      await expect(
        service.updateDriverLocation(orderId, driverId, { lat: 19, lng: 72 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('stores location in Redis and returns recordedAt', async () => {
      ordersFindOne.mockResolvedValue(baseOrder());
      const res = await service.updateDriverLocation(orderId, driverId, {
        lat: 19.1,
        lng: 72.8,
        heading: 90,
      });
      expect(res.ok).toBe(true);
      expect(res.recordedAt).toMatch(/^\d{4}-/);
      expect(redisSetex).toHaveBeenCalledWith(
        `delivery:loc:${orderId}`,
        expect.any(Number),
        expect.stringContaining('"lat":19.1'),
      );
    });
  });

  describe('getTrackingSnapshot', () => {
    it('throws NotFoundException when order missing', async () => {
      ordersFindOne.mockResolvedValue(null);
      await expect(
        service.getTrackingSnapshot(orderId, {
          userId: clientId,
          role: UserRole.CLIENT,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when client does not own order', async () => {
      ordersFindOne.mockResolvedValue(
        baseOrder({ status: OrderStatus.PICKED_UP }),
      );
      await expect(
        service.getTrackingSnapshot(orderId, {
          userId: 'other',
          role: UserRole.CLIENT,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when client before PICKED_UP', async () => {
      ordersFindOne.mockResolvedValue(
        baseOrder({ status: OrderStatus.READY }),
      );
      await expect(
        service.getTrackingSnapshot(orderId, {
          userId: clientId,
          role: UserRole.CLIENT,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns snapshot with route when driver position and API succeed', async () => {
      ordersFindOne.mockResolvedValue(
        baseOrder({ status: OrderStatus.OUT_FOR_DELIVERY }),
      );
      redisGet
        .mockResolvedValueOnce(
          JSON.stringify({
            lat: 19.0,
            lng: 72.8,
            heading: null,
            recordedAt: '2026-01-01T00:00:00.000Z',
          }),
        )
        .mockResolvedValueOnce(null);

      computeRoute.mockResolvedValue({
        distanceMeters: 1000,
        durationSeconds: 120,
        encodedPolyline: 'abc',
      });

      const snap = await service.getTrackingSnapshot(orderId, {
        userId: clientId,
        role: UserRole.CLIENT,
      });

      expect(snap.phase).toBe('TO_DROPOFF');
      expect(snap.driver_position?.lat).toBe(19.0);
      expect(snap.route?.encodedPolyline).toBe('abc');
      expect(snap.route?.distanceMeters).toBe(1000);
      expect(snap.route_error).toBeNull();
      expect(redisSetex).toHaveBeenCalledWith(
        `delivery:route:${orderId}`,
        expect.any(Number),
        expect.any(String),
      );
    });

    it('sets route_error when API key missing', async () => {
      getApiKey.mockReturnValue(undefined);
      ordersFindOne.mockResolvedValue(
        baseOrder({ status: OrderStatus.PICKED_UP }),
      );
      redisGet.mockResolvedValue(
        JSON.stringify({
          lat: 19,
          lng: 72,
          heading: null,
          recordedAt: '2026-01-01T00:00:00.000Z',
        }),
      );

      const snap = await service.getTrackingSnapshot(orderId, {
        userId: clientId,
        role: UserRole.CLIENT,
      });

      expect(snap.route).toBeNull();
      expect(snap.route_error).toContain('GOOGLE_MAPS_API_KEY');
    });
  });
});
