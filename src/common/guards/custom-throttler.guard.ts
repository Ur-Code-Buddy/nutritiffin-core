import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
    protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
        const isProd = process.env.PRODUCTION !== 'false';

        // Completely bypass rate limiting when not in production
        // This ignores any route-level @Throttle overrides as well.
        if (!isProd) {
            return true;
        }

        // Call the parent implementation to enforce limitations where PRODUCTION is true
        return super.shouldSkip(context);
    }
}
