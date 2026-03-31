import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchensService } from './kitchens.service';
import { KitchensController } from './kitchens.controller';
import { KitchenPayoutsController } from './kitchen-payouts.controller';
import { KitchenPayoutsService } from './kitchen-payouts.service';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantStatsService } from './restaurant-stats.service';
import { Kitchen } from './entities/kitchen.entity';
import { KitchenBankDetails } from './entities/kitchen-bank-details.entity';
import { CommonModule } from '../common/common.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Kitchen, KitchenBankDetails]),
    CommonModule,
    UsersModule,
  ],
  controllers: [KitchensController, KitchenPayoutsController, RestaurantsController],
  providers: [KitchensService, KitchenPayoutsService, RestaurantStatsService],
  exports: [KitchensService],
})
export class KitchensModule {}
