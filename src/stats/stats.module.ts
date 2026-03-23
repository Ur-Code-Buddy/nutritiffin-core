import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Kitchen } from '../kitchens/entities/kitchen.entity';
import { Order } from '../orders/entities/order.entity';
import { StatsPublicController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Kitchen, Order])],
  controllers: [StatsPublicController],
  providers: [StatsService],
})
export class StatsModule {}
