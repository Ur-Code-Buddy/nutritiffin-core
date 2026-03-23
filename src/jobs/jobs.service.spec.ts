import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { OrdersService } from '../orders/orders.service';

describe('JobsService', () => {
  let service: JobsService;
  let rejectPendingOrderByTimeout: jest.Mock;

  beforeEach(async () => {
    rejectPendingOrderByTimeout = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: OrdersService,
          useValue: { rejectPendingOrderByTimeout },
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('order-timeout job delegates to OrdersService.rejectPendingOrderByTimeout', async () => {
    await service.process({
      name: 'order-timeout',
      data: { orderId: 'ord-1' },
    } as any);
    expect(rejectPendingOrderByTimeout).toHaveBeenCalledWith('ord-1');
  });
});
