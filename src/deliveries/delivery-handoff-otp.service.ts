import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { RedisService } from '../redis/redis.service';

const OTP_KEY_PREFIX = 'delivery_handoff_otp:';
const ATTEMPTS_KEY_PREFIX = 'delivery_handoff_otp_attempts:';
const DEFAULT_TTL_SECONDS = 4 * 60 * 60; // 4 hours
const MAX_VERIFY_ATTEMPTS = 10;
/** In-app code the customer shows the driver before handover */
const HANDOFF_OTP_DIGITS = 4;

@Injectable()
export class DeliveryHandoffOtpService {
  private readonly logger = new Logger(DeliveryHandoffOtpService.name);

  constructor(private readonly redisService: RedisService) {}

  private otpKey(orderId: string): string {
    return `${OTP_KEY_PREFIX}${orderId}`;
  }

  private attemptsKey(orderId: string): string {
    return `${ATTEMPTS_KEY_PREFIX}${orderId}`;
  }

  private generateOtp(): string {
    const max = 10 ** HANDOFF_OTP_DIGITS;
    return crypto.randomInt(0, max).toString().padStart(HANDOFF_OTP_DIGITS, '0');
  }

  private timingSafeOtpEq(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
    } catch {
      return false;
    }
  }

  /**
   * Called when the order becomes OUT_FOR_DELIVERY — replaces any prior code for this order.
   */
  async issueForOrder(orderId: string): Promise<void> {
    const otp = this.generateOtp();
    const key = this.otpKey(orderId);
    try {
      await this.redisService.client.setex(key, DEFAULT_TTL_SECONDS, otp);
      await this.redisService.client.del(this.attemptsKey(orderId));
    } catch (err) {
      this.logger.error(`Failed to store delivery handoff OTP for order ${orderId}`, err);
      throw new BadRequestException(
        'Could not issue delivery handoff code. Try again shortly.',
      );
    }
  }

  /**
   * Client app: show this code to the driver. Reuses the active code; creates one if missing (Redis flush / legacy order).
   */
  async getOrCreateForOrder(orderId: string): Promise<{
    otp: string;
    expires_in_seconds: number;
  }> {
    const key = this.otpKey(orderId);
    try {
      let otp = await this.redisService.client.get(key);
      if (!otp) {
        otp = this.generateOtp();
        await this.redisService.client.setex(key, DEFAULT_TTL_SECONDS, otp);
        await this.redisService.client.del(this.attemptsKey(orderId));
      }
      const ttl = await this.redisService.client.ttl(key);
      const expires_in_seconds = ttl > 0 ? ttl : DEFAULT_TTL_SECONDS;
      return { otp, expires_in_seconds };
    } catch (err) {
      this.logger.error(`Failed to read/create handoff OTP for order ${orderId}`, err);
      throw new BadRequestException(
        'Could not load delivery handoff code. Try again shortly.',
      );
    }
  }

  /**
   * Validates the code and removes it from Redis so it cannot be reused.
   */
  async verifyAndConsume(orderId: string, submitted: string): Promise<void> {
    const normalized = (submitted ?? '').trim();
    if (!new RegExp(`^\\d{${HANDOFF_OTP_DIGITS}}$`).test(normalized)) {
      throw new BadRequestException(
        `Handoff code must be exactly ${HANDOFF_OTP_DIGITS} digits`,
      );
    }

    const oKey = this.otpKey(orderId);
    const aKey = this.attemptsKey(orderId);

    let stored: string | null;
    try {
      stored = await this.redisService.client.get(oKey);
    } catch (err) {
      this.logger.error(`Redis error reading handoff OTP for order ${orderId}`, err);
      throw new BadRequestException(
        'Could not verify handoff code. Try again shortly.',
      );
    }

    if (!stored) {
      throw new BadRequestException(
        'Handoff code is missing or expired. Ask the customer to open the app and refresh the code.',
      );
    }

    if (this.timingSafeOtpEq(stored, normalized)) {
      try {
        await this.redisService.client.del(oKey, aKey);
      } catch (err) {
        this.logger.warn(`Failed to delete handoff OTP keys for order ${orderId}`, err);
      }
      return;
    }

    try {
      const attempts = await this.redisService.client.incr(aKey);
      if (attempts === 1) {
        const ttl = await this.redisService.client.ttl(oKey);
        if (ttl > 0) {
          await this.redisService.client.expire(aKey, ttl);
        } else {
          await this.redisService.client.expire(aKey, DEFAULT_TTL_SECONDS);
        }
      }
      if (attempts >= MAX_VERIFY_ATTEMPTS) {
        throw new HttpException(
          'Too many incorrect handoff attempts. Ask the customer to confirm the code from their app.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Redis error recording handoff attempt for order ${orderId}`, err);
    }

    throw new BadRequestException('Invalid handoff code');
  }
}
