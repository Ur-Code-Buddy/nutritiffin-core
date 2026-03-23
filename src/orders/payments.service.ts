import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService, RazorpayPaymentMeta } from './orders.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { Order, PaymentStatus, RefundStatus } from './entities/order.entity';

export type RefundCapturedPaymentResult =
  | { type: 'not_paid' }
  | { type: 'already_recorded'; refundId: string }
  | { type: 'success'; refundId: string }
  | { type: 'already_refunded'; refundId: string }
  | { type: 'error'; message: string };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
  ) {}

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

  async initiate(
    clientId: string,
    dto: CreateOrderDto,
  ): Promise<{ razorpayOrderId: string; publicKey: string }> {
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

    const zpOrder = (await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      payment_capture: true,
    })) as any;

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
      throw new BadRequestException(
        'Razorpay payment does not match the order',
      );
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
      return await this.ordersService.create(
        clientId,
        dto.originalDto,
        paymentMeta,
      );
    } catch (err: any) {
      // Avoid leaking Razorpay internals; surface order validation issues as BadRequest.
      this.logger.error('Failed to create paid order', err?.message ?? err);
      throw err;
    }
  }

  /**
   * Full refund in paise for a captured payment. Idempotent when order already has a recorded refund.
   */
  async refundCapturedPaymentForOrder(
    order: Order,
  ): Promise<RefundCapturedPaymentResult> {
    if (
      order.paymentStatus !== PaymentStatus.PAID ||
      !order.razorpayPaymentId
    ) {
      return { type: 'not_paid' };
    }

    if (
      order.razorpay_refund_id &&
      (order.refund_status === RefundStatus.PENDING ||
        order.refund_status === RefundStatus.COMPLETED)
    ) {
      return { type: 'already_recorded', refundId: order.razorpay_refund_id };
    }

    const { client: razorpay } = this.getRazorpayClient();
    const amountPaise = Math.round(Number(order.total_price) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return { type: 'error', message: 'Invalid order amount for refund' };
    }

    try {
      const refund = (await razorpay.payments.refund(
        order.razorpayPaymentId,
        { amount: amountPaise },
      )) as { id?: string };
      if (!refund?.id) {
        return { type: 'error', message: 'Razorpay refund returned no id' };
      }
      return { type: 'success', refundId: refund.id };
    } catch (err: any) {
      const desc =
        err?.error?.description || err?.message || String(err);
      this.logger.warn(
        `Razorpay refund failed for order ${order.id}: ${desc}`,
      );

      try {
        const payment = (await razorpay.payments.fetch(
          order.razorpayPaymentId,
        )) as {
          amount?: number | string;
          amount_refunded?: number | string;
          refunds?: { items?: { id: string }[] };
        };
        const amt = Number(payment.amount);
        const refunded = Number(payment.amount_refunded ?? 0);
        if (refunded >= amt && amt > 0) {
          const items = payment.refunds?.items ?? [];
          const last = items[items.length - 1];
          if (last?.id) {
            return { type: 'already_refunded', refundId: last.id };
          }
          return {
            type: 'error',
            message: 'Payment appears refunded but refund id unavailable',
          };
        }
      } catch (fetchErr: any) {
        this.logger.warn(
          `Could not reconcile payment after refund error: ${fetchErr?.message ?? fetchErr}`,
        );
      }

      return { type: 'error', message: desc };
    }
  }
}
