import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { UserRole } from '../users/user.role.enum';
import { RedisService } from '../redis/redis.service';
import { GoogleRoutesService, type LatLng } from './google-routes.service';
import { GoogleGeocodingService } from './google-geocoding.service';
import { NotificationsService } from '../notifications/notifications.service';

const LOC_KEY = (orderId: string) => `delivery:loc:${orderId}`;
const ROUTE_KEY = (orderId: string) => `delivery:route:${orderId}`;
const NEARBY_SENT_KEY = (orderId: string) => `delivery:nearby_sent:${orderId}`;

const LOC_TTL_SEC = 48 * 3600;
const ROUTE_CACHE_TTL_SEC = 55;
const NEARBY_THRESHOLD_METERS = 500;
const NEARBY_FLAG_TTL_SEC = 86400;

export type TrackingPhase = 'TO_PICKUP' | 'TO_DROPOFF';

export type DriverPositionDto = {
  lat: number;
  lng: number;
  heading: number | null;
  recordedAt: string;
};

export type TrackingRouteDto = {
  encodedPolyline: string;
  distanceMeters: number;
  durationSeconds: number;
  eta: string | null;
};

export type TrackingSnapshotDto = {
  order_id: string;
  order_status: OrderStatus;
  phase: TrackingPhase;
  driver_position: DriverPositionDto | null;
  destination: {
    latitude: number;
    longitude: number;
    label: string;
  } | null;
  route: TrackingRouteDto | null;
  route_error: string | null;
};

const DRIVER_LOCATION_STATUSES: OrderStatus[] = [
  OrderStatus.READY,
  OrderStatus.PICKED_UP,
  OrderStatus.OUT_FOR_DELIVERY,
];

const CLIENT_TRACKING_STATUSES: OrderStatus[] = [
  OrderStatus.PICKED_UP,
  OrderStatus.OUT_FOR_DELIVERY,
];

const DRIVER_TRACKING_STATUSES: OrderStatus[] = [
  OrderStatus.ACCEPTED,
  OrderStatus.READY,
  OrderStatus.PICKED_UP,
  OrderStatus.OUT_FOR_DELIVERY,
];

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toLatLngFromEntity(
  lat: string | number | null | undefined,
  lng: string | number | null | undefined,
): LatLng | null {
  if (lat == null || lng == null) return null;
  const latitude = typeof lat === 'number' ? lat : parseFloat(String(lat));
  const longitude = typeof lng === 'number' ? lng : parseFloat(String(lng));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
}

@Injectable()
export class DeliveryTrackingService {
  private readonly logger = new Logger(DeliveryTrackingService.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly redisService: RedisService,
    private readonly googleRoutes: GoogleRoutesService,
    private readonly googleGeocoding: GoogleGeocodingService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private phaseForStatus(status: OrderStatus): TrackingPhase {
    if (
      status === OrderStatus.PICKED_UP ||
      status === OrderStatus.OUT_FOR_DELIVERY
    ) {
      return 'TO_DROPOFF';
    }
    return 'TO_PICKUP';
  }

  async updateDriverLocation(
    orderId: string,
    driverId: string,
    dto: { lat: number; lng: number; heading?: number },
  ): Promise<{ ok: true; recordedAt: string }> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['client', 'kitchen'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.delivery_driver_id !== driverId) {
      throw new ForbiddenException('You are not the driver for this order');
    }

    if (!DRIVER_LOCATION_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        'Location updates are only allowed when the order is READY, PICKED_UP, or OUT_FOR_DELIVERY',
      );
    }

    const recordedAt = new Date().toISOString();
    const payload = {
      lat: dto.lat,
      lng: dto.lng,
      heading:
        dto.heading !== undefined && Number.isFinite(dto.heading)
          ? dto.heading
          : null,
      recordedAt,
    };

    try {
      await this.redisService.client.setex(
        LOC_KEY(orderId),
        LOC_TTL_SEC,
        JSON.stringify(payload),
      );
    } catch (e) {
      this.logger.error('Redis set delivery location failed', e);
      throw new BadRequestException('Failed to record location');
    }

    await this.maybeSendNearbyNotification(order, dto.lat, dto.lng);

    return { ok: true, recordedAt };
  }

  private async maybeSendNearbyNotification(
    order: Order,
    driverLat: number,
    driverLng: number,
  ): Promise<void> {
    if (order.status !== OrderStatus.OUT_FOR_DELIVERY) {
      return;
    }

    const client = order.client;
    if (!client?.fcm_token) return;

    const dropoff = await this.resolveDropoffLatLng(order);
    if (!dropoff) return;

    const dist = haversineMeters(
      { latitude: driverLat, longitude: driverLng },
      dropoff,
    );
    if (dist > NEARBY_THRESHOLD_METERS) return;

    const redis = this.redisService.client;
    const flagKey = NEARBY_SENT_KEY(order.id);
    try {
      const set = await redis.set(
        flagKey,
        '1',
        'EX',
        NEARBY_FLAG_TTL_SEC,
        'NX',
      );
      if (set !== 'OK') return;

      this.notificationsService
        .sendPushNotification(
          client.fcm_token,
          'Driver is nearby',
          'Your delivery partner is approaching your location.',
          { orderId: order.id, type: 'driver_nearby' },
        )
        .catch((err) => this.logger.error('Nearby push notification failed', err));
    } catch (e) {
      this.logger.warn('Nearby notification redis check failed', e);
    }
  }

  private async resolveKitchenLatLng(order: Order): Promise<LatLng | null> {
    const k = order.kitchen;
    if (!k) return null;

    const direct = toLatLngFromEntity(k.latitude, k.longitude);
    if (direct) return direct;

    const addr = k.details?.address?.trim();
    if (!addr) return null;

    return this.googleGeocoding.resolveAddress(
      this.redisService.client,
      addr,
    );
  }

  private async resolveDropoffLatLng(order: Order): Promise<LatLng | null> {
    const c = order.client;
    if (!c) return null;

    const direct = toLatLngFromEntity(c.latitude, c.longitude);
    if (direct) return direct;

    const addr = `${c.address?.trim() || ''}, ${c.pincode?.trim() || ''}`.trim();
    if (!addr || addr === ',') return null;

    return this.googleGeocoding.resolveAddress(
      this.redisService.client,
      addr,
    );
  }

  async getTrackingSnapshot(
    orderId: string,
    requester: { userId: string; role: UserRole },
  ): Promise<TrackingSnapshotDto> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['kitchen', 'client', 'delivery_driver'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const { userId, role } = requester;

    if (role === UserRole.CLIENT) {
      if (order.client_id !== userId) {
        throw new ForbiddenException('You can only track your own orders');
      }
      if (!CLIENT_TRACKING_STATUSES.includes(order.status)) {
        throw new BadRequestException(
          'Live tracking is available after pickup (PICKED_UP or OUT_FOR_DELIVERY)',
        );
      }
    } else if (role === UserRole.DELIVERY_DRIVER) {
      if (order.delivery_driver_id !== userId) {
        throw new ForbiddenException('Not assigned to this order');
      }
      if (!DRIVER_TRACKING_STATUSES.includes(order.status)) {
        throw new BadRequestException(
          'Tracking is not available for this order status',
        );
      }
    } else if (role === UserRole.ADMIN) {
      if (!DRIVER_TRACKING_STATUSES.includes(order.status)) {
        throw new BadRequestException(
          'Tracking is not available for this order status',
        );
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    const phase = this.phaseForStatus(order.status);

    let driverPosition: DriverPositionDto | null = null;
    try {
      const raw = await this.redisService.client.get(LOC_KEY(orderId));
      if (raw) {
        const p = JSON.parse(raw) as {
          lat: number;
          lng: number;
          heading: number | null;
          recordedAt: string;
        };
        if (
          typeof p.lat === 'number' &&
          typeof p.lng === 'number' &&
          p.recordedAt
        ) {
          driverPosition = {
            lat: p.lat,
            lng: p.lng,
            heading:
              p.heading !== null && p.heading !== undefined
                ? p.heading
                : null,
            recordedAt: p.recordedAt,
          };
        }
      }
    } catch {
      /* ignore */
    }

    const destinationCoords =
      phase === 'TO_PICKUP'
        ? await this.resolveKitchenLatLng(order)
        : await this.resolveDropoffLatLng(order);

    const destination = destinationCoords
      ? {
          latitude: destinationCoords.latitude,
          longitude: destinationCoords.longitude,
          label:
            phase === 'TO_PICKUP'
              ? order.kitchen?.name || 'Pickup'
              : order.client?.address || 'Delivery',
        }
      : null;

    let route: TrackingRouteDto | null = null;
    let route_error: string | null = null;

    if (!this.googleRoutes.getApiKey()) {
      route_error = 'GOOGLE_MAPS_API_KEY is not configured';
    } else if (!driverPosition) {
      route_error = 'Driver position not yet reported';
    } else if (!destinationCoords) {
      route_error =
        'Destination coordinates unavailable; set kitchen/client latitude and longitude or ensure addresses geocode';
    } else {
      const origin: LatLng = {
        latitude: driverPosition.lat,
        longitude: driverPosition.lng,
      };

      try {
        const cached = await this.redisService.client.get(ROUTE_KEY(orderId));
        if (cached) {
          const parsed = JSON.parse(cached) as TrackingRouteDto;
          if (
            parsed?.encodedPolyline &&
            typeof parsed.distanceMeters === 'number'
          ) {
            route = parsed;
          }
        }

        if (!route) {
          const computed = await this.googleRoutes.computeRoute(
            origin,
            destinationCoords,
          );
          if (computed) {
            const eta =
              computed.durationSeconds > 0
                ? new Date(
                    Date.now() + computed.durationSeconds * 1000,
                  ).toISOString()
                : null;
            route = {
              encodedPolyline: computed.encodedPolyline,
              distanceMeters: computed.distanceMeters,
              durationSeconds: computed.durationSeconds,
              eta,
            };
            await this.redisService.client.setex(
              ROUTE_KEY(orderId),
              ROUTE_CACHE_TTL_SEC,
              JSON.stringify(route),
            );
          } else {
            route_error = 'Could not compute route';
          }
        }
      } catch (e) {
        this.logger.warn('Route cache or compute failed', e);
        route_error = 'Could not compute route';
      }
    }

    return {
      order_id: order.id,
      order_status: order.status,
      phase,
      driver_position: driverPosition,
      destination,
      route,
      route_error,
    };
  }
}
