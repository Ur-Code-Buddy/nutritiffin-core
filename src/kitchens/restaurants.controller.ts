import {
  applyDecorators,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ForceThrottle } from '../common/decorators/force-throttle.decorator';
import { KitchensService } from './kitchens.service';
import { RestaurantStatsService } from './restaurant-stats.service';

function PublicStatsThrottles() {
  return applyDecorators(
    SkipThrottle({ default: true, hourly: true }),
    ForceThrottle(),
    Throttle({ publicStats: { limit: 20, ttl: 60000 } }),
  );
}

/** Public "restaurant" surface: IDs match kitchens in this API. */
@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private readonly kitchensService: KitchensService,
    private readonly restaurantStatsService: RestaurantStatsService,
  ) {}

  @Get(':id/stats')
  @PublicStatsThrottles()
  async stats(@Param('id', ParseUUIDPipe) id: string) {
    await this.kitchensService.findOne(id);
    return this.restaurantStatsService.getStats(id);
  }
}
