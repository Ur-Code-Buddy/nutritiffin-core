import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';

@Processor('orders')
export class JobsService extends WorkerHost {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly ordersService: OrdersService) {
    super();
  }

  async process(job: Job<{ orderId: string }>): Promise<any> {
    if (job.name === 'order-timeout') {
      const { orderId } = job.data;
      this.logger.log(`Processing timeout for order ${orderId}`);
      await this.ordersService.rejectPendingOrderByTimeout(orderId);
    }
  }
}
