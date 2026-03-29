import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveriesService } from './deliveries.service';
import { DeliveryHandoffOtpService } from './delivery-handoff-otp.service';
import { DeliveriesController } from './deliveries.controller';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeliveryTrackingModule } from '../delivery-tracking/delivery-tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, User]),
    NotificationsModule,
    DeliveryTrackingModule,
  ],
  controllers: [DeliveriesController],
  providers: [DeliveriesService, DeliveryHandoffOtpService],
  exports: [DeliveriesService, DeliveryHandoffOtpService],
})
export class DeliveriesModule {}
