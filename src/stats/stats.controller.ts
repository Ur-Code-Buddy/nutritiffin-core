import { applyDecorators, Controller, Get } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ForceThrottle } from '../common/decorators/force-throttle.decorator';
import { StatsService } from './stats.service';

/** Shared throttling for all public stats URLs (20/min; enforced even when PRODUCTION=false). */
function PublicStatsThrottles() {
  return applyDecorators(
    SkipThrottle({ default: true, hourly: true }),
    ForceThrottle(),
    Throttle({ publicStats: { limit: 20, ttl: 60000 } }),
  );
}

/**
 * Full path routes on the root controller so they always match what Express receives
 * (avoids issues with nested controller paths + proxies). Register both:
 * - After `/api` is stripped: GET /v1/stats/public
 * - Direct to Nest: GET /api/v1/stats/public
 */
@Controller()
export class StatsPublicController {
  constructor(private readonly statsService: StatsService) {}

  @Get('v1/stats/public')
  @PublicStatsThrottles()
  getPublicV1() {
    return this.statsService.getPublicStats();
  }

  @Get('api/v1/stats/public')
  @PublicStatsThrottles()
  getPublicApiV1() {
    return this.statsService.getPublicStats();
  }
}
