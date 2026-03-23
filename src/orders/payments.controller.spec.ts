import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CreateOrderDto } from './dto/create-order.dto';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: jest.Mocked<PaymentsService>;

  const mockReq = { user: { userId: 'client-uuid-1' } };

  const createOrderDto: CreateOrderDto = {
    kitchen_id: 'kitchen-uuid',
    scheduled_for: '2026-02-16',
    items: [{ food_item_id: 'item-uuid', quantity: 1 }],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            initiate: jest.fn(),
            confirm: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    paymentsService = module.get(PaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('initiate delegates to PaymentsService.initiate with user id and dto', async () => {
    (paymentsService.initiate as jest.Mock).mockResolvedValue({
      razorpayOrderId: 'order_123',
      publicKey: 'rzp_test_xxx',
    });

    const result = await controller.initiate(mockReq as any, createOrderDto);

    expect(paymentsService.initiate).toHaveBeenCalledWith('client-uuid-1', createOrderDto);
    expect(result).toEqual({ razorpayOrderId: 'order_123', publicKey: 'rzp_test_xxx' });
  });

  it('confirm delegates to PaymentsService.confirm with user id and dto', async () => {
    const confirmDto = {
      razorpayOrderId: 'order_123',
      razorpayPaymentId: 'pay_456',
      razorpaySignature: 'sig',
      originalDto: createOrderDto,
    };
    const savedOrder = { id: 'order-db-id', status: 'PENDING' };
    (paymentsService.confirm as jest.Mock).mockResolvedValue(savedOrder);

    const result = await controller.confirm(mockReq as any, confirmDto);

    expect(paymentsService.confirm).toHaveBeenCalledWith('client-uuid-1', confirmDto);
    expect(result).toEqual(savedOrder);
  });
});
