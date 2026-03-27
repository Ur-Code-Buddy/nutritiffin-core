import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { RedisModule } from '../redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GoogleRoutesService } from './google-routes.service';
import { GoogleGeocodingService } from './google-geocoding.service';
import { DeliveryTrackingService } from './delivery-tracking.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    RedisModule,
    NotificationsModule,
  ],
  providers: [
    GoogleRoutesService,
    GoogleGeocodingService,
    DeliveryTrackingService,
  ],
  exports: [DeliveryTrackingService],
})
export class DeliveryTrackingModule {}
