import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { PaymentsService } from './payments.service';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

// Use `var` so the Razorpay mock can safely assign to these without TDZ issues.
var ordersCreateMock: jest.Mock;
var paymentsFetchMock: jest.Mock;

jest.mock('razorpay', () => {
  ordersCreateMock = jest.fn();
  paymentsFetchMock = jest.fn();

  return jest.fn().mockImplementation(() => ({
    orders: { create: ordersCreateMock },
    payments: { fetch: paymentsFetchMock },
  }));
});

describe('PaymentsService (Razorpay)', () => {
  let paymentsService: PaymentsService;
  let ordersService: jest.Mocked<OrdersService>;
  let configService: jest.Mocked<ConfigService>;

  const publicKey = 'rzp_test_public';
  const secretKey = 'rzp_test_secret';

  const baseDto: CreateOrderDto = {
    kitchen_id: 'c282d569-e3a9-4820-ad35-d4093a8b96d8',
    scheduled_for: '2026-02-16',
    items: [{ food_item_id: 'aebf865c-ab8e-405b-9e5b-ab4fce869084', quantity: 2 }],
  };

  const buildSignature = (razorpayOrderId: string, razorpayPaymentId: string) =>
    crypto
      .createHmac('sha256', secretKey)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

  beforeEach(async () => {
    ordersCreateMock.mockReset();
    paymentsFetchMock.mockReset();

    ordersService = {
      calculateOrderQuote: jest.fn(),
      create: jest.fn(),
    } as any;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'RAZORPAY_API_KEY') return publicKey;
        if (key === 'RAZORPAY_KEY_SECRET') return secretKey;
        return undefined;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: OrdersService, useValue: ordersService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
  });

  it('initiate converts rupees total to paise and creates Razorpay order', async () => {
    (ordersService.calculateOrderQuote as jest.Mock).mockResolvedValue({
      grandTotal: 51,
    });

    (ordersCreateMock as jest.Mock).mockResolvedValue({ id: 'order_zp_123' });

    const res = await paymentsService.initiate('client-1', baseDto);

    expect(ordersService.calculateOrderQuote).toHaveBeenCalledWith(baseDto);
    expect(ordersCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5100,
        currency: 'INR',
        payment_capture: true,
      }),
    );
    expect(res).toEqual({ razorpayOrderId: 'order_zp_123', publicKey });
  });

  it('confirm throws BadRequestException when signature is invalid', async () => {
    const razorpayOrderId = 'order_zp_123';
    const razorpayPaymentId = 'pay_zp_456';

    await expect(
      paymentsService.confirm('client-1', {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: 'bad_signature',
        originalDto: baseDto,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(paymentsFetchMock).not.toHaveBeenCalled();
    expect(ordersService.calculateOrderQuote).not.toHaveBeenCalled();
    expect(ordersService.create).not.toHaveBeenCalled();
  });

  it('confirm throws when payment is not captured', async () => {
    const razorpayOrderId = 'order_zp_123';
    const razorpayPaymentId = 'pay_zp_456';
    const signature = buildSignature(razorpayOrderId, razorpayPaymentId);

    (ordersService.calculateOrderQuote as jest.Mock).mockResolvedValue({
      grandTotal: 51,
    });

    (paymentsFetchMock as jest.Mock).mockResolvedValue({
      order_id: razorpayOrderId,
      status: 'failed',
      amount: '5100',
    });

    await expect(
      paymentsService.confirm('client-1', {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: signature,
        originalDto: baseDto,
      }),
    ).rejects.toThrow('Razorpay payment is not captured');

    expect(paymentsFetchMock).toHaveBeenCalledWith(razorpayPaymentId);
  });

  it('confirm throws when amount does not match backend quote', async () => {
    const razorpayOrderId = 'order_zp_123';
    const razorpayPaymentId = 'pay_zp_456';
    const signature = buildSignature(razorpayOrderId, razorpayPaymentId);

    (ordersService.calculateOrderQuote as jest.Mock).mockResolvedValue({
      grandTotal: 51,
    });

    (paymentsFetchMock as jest.Mock).mockResolvedValue({
      order_id: razorpayOrderId,
      status: 'captured',
      amount: '5090',
    });

    await expect(
      paymentsService.confirm('client-1', {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: signature,
        originalDto: baseDto,
      }),
    ).rejects.toThrow('Razorpay payment amount mismatch');

    expect(paymentsFetchMock).toHaveBeenCalledWith(razorpayPaymentId);
    expect(ordersService.create).not.toHaveBeenCalled();
  });
});

