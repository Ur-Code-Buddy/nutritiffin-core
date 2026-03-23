import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService, RazorpayPaymentMeta } from './orders.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
  ) { }

  private getRazorpayClient() {
    const publicKey = this.configService.get<string>('RAZORPAY_API_KEY');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (!publicKey || !keySecret) {
      throw new BadRequestException('Razorpay keys are not configured');
    }

    return {
      client: new Razorpay({
        key_id: publicKey,
        key_secret: keySecret,
      }),
      publicKey,
      keySecret,
    };
  }

  private computeExpectedSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    keySecret: string,
  ) {
    return crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
  }

  async initiate(clientId: string, dto: CreateOrderDto): Promise<{ razorpayOrderId: string; publicKey: string }> {
    // clientId currently only used for receipt metadata (no auth role logic here).
    void clientId;

    const { client: razorpay, publicKey } = this.getRazorpayClient();

    // Runs the full validation suite but does not create/save an Order.
    const quote = await this.ordersService.calculateOrderQuote(dto);
    const amountInPaise = Math.round(quote.grandTotal * 100);

    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
      throw new BadRequestException('Invalid order total for payment');
    }

    const receipt = `ORD-${dto.kitchen_id.substring(0, 6)}-${Date.now()}`;

    const zpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      payment_capture: true,
    }) as any;

    if (!zpOrder?.id) {
      throw new BadRequestException('Failed to create Razorpay order');
    }

    return { razorpayOrderId: zpOrder.id, publicKey };
  }

  async confirm(clientId: string, dto: ConfirmPaymentDto) {
    const { client: razorpay, keySecret } = this.getRazorpayClient();

    // 1) HMAC signature verification
    const expected = this.computeExpectedSignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      keySecret,
    );
    const provided = dto.razorpaySignature;

    const providedBuf = Buffer.from(provided, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const signaturesMatch =
      providedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(providedBuf, expectedBuf);

    if (!signaturesMatch) {
      throw new BadRequestException('Invalid Razorpay payment signature');
    }

    // 2) Fetch payment from Razorpay API and verify it is captured for the given order
    const payment = await razorpay.payments.fetch(dto.razorpayPaymentId);

    if (!payment || payment.order_id !== dto.razorpayOrderId) {
      throw new BadRequestException('Razorpay payment does not match the order');
    }

    if (payment.status !== 'captured') {
      throw new BadRequestException('Razorpay payment is not captured');
    }

    // 3) Verify amount matches what the backend computed
    const quote = await this.ordersService.calculateOrderQuote(dto.originalDto);
    const expectedAmountInPaise = Math.round(quote.grandTotal * 100);
    const actualAmountInPaise = Number(payment.amount);

    if (actualAmountInPaise !== expectedAmountInPaise) {
      throw new BadRequestException('Razorpay payment amount mismatch');
    }

    // 4) Persist the order only after payment verification
    const paymentMeta: RazorpayPaymentMeta = {
      razorpayOrderId: dto.razorpayOrderId,
      razorpayPaymentId: dto.razorpayPaymentId,
    };

    try {
      return await this.ordersService.create(clientId, dto.originalDto, paymentMeta);
    } catch (err: any) {
      // Avoid leaking Razorpay internals; surface order validation issues as BadRequest.
      this.logger.error('Failed to create paid order', err?.message ?? err);
      throw err;
    }
  }
}

