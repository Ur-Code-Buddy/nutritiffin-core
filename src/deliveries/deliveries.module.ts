import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveriesService } from './deliveries.service';
import { DeliveryHandoffOtpService } from './delivery-handoff-otp.service';
import { DeliveriesController } from './deliveries.controller';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, User]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [DeliveriesController],
  providers: [DeliveriesService, DeliveryHandoffOtpService],
  exports: [DeliveriesService, DeliveryHandoffOtpService],
})
export class DeliveriesModule {}
