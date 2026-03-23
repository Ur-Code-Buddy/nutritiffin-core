import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsService } from './jobs.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    BullModule.registerQueue({
      name: 'orders',
    }),
  ],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
