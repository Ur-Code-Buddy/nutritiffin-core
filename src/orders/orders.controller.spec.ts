import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { KitchensService } from '../kitchens/kitchens.service';
import { DeliveryHandoffOtpService } from '../deliveries/delivery-handoff-otp.service';
import { DeliveryTrackingService } from '../delivery-tracking/delivery-tracking.service';

describe('OrdersController', () => {
  let controller: OrdersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: KitchensService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DeliveryHandoffOtpService,
          useValue: {
            getOrCreateForOrder: jest.fn(),
          },
        },
        {
          provide: DeliveryTrackingService,
          useValue: {
            getTrackingSnapshot: jest.fn(),
            updateDriverLocation: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
