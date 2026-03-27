import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { FoodItemsModule } from '../food-items/food-items.module';
import { KitchensModule } from '../kitchens/kitchens.module';
import { FoodItem } from '../food-items/entities/food-item.entity';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeliveriesModule } from '../deliveries/deliveries.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, FoodItem]),
    BullModule.registerQueue({
      name: 'orders',
    }),
    FoodItemsModule,
    KitchensModule,
    UsersModule,
    NotificationsModule,
    DeliveriesModule,
  ],
  controllers: [OrdersController, PaymentsController],
  providers: [OrdersService, PaymentsService],
  exports: [OrdersService],
})
export class OrdersModule {}
