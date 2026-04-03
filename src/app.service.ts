import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AllowedPincode } from './common/entities/allowed-pincode.entity';
import { RedisService } from './redis/redis.service';

/** Redis: missing = not under maintenance; "0" = off; else unix ms until maintenance ends */
const MAINTENANCE_UNTIL_KEY = 'nutri:maintenance_until';
/** Unix ms when the maintenance window starts (optional; missing = legacy “already started”). */
const MAINTENANCE_FROM_KEY = 'nutri:maintenance_from';
/** "1" = no fixed end (omit hours); response omits concrete `maintenance_ends_at`. */
const MAINTENANCE_OPEN_ENDED_KEY = 'nutri:maintenance_open_ended';

const FAR_FUTURE_MS = 100 * 365 * 24 * 3600000;

export type MaintenanceStatus = {
  is_under_maintainance: boolean;
  maintenance_starts_at: string | null;
  maintenance_ends_at: string | null;
};

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(AllowedPincode)
    private readonly pincodeRepo: Repository<AllowedPincode>,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    // Seed default pincodes if none exist
    const count = await this.pincodeRepo.count();
    if (count === 0) {
      const defaults = [605001, 605002, 605003];
      const entities = defaults.map((p) =>
        this.pincodeRepo.create({ pincode: p }),
      );
      await this.pincodeRepo.save(entities);
    }
  }

  getHello(): string {
    return 'This is Nutri Tiffin!';
  }

  async isDistrictAvailable(pincode: string): Promise<boolean> {
    if (!pincode) return false;
    const pin = parseInt(pincode, 10);
    if (isNaN(pin)) return false;
    const result = await this.pincodeRepo.findOne({
      where: { pincode: pin, is_active: true },
    });
    return !!result;
  }

  async addPincode(pincode: number): Promise<AllowedPincode> {
    const existing = await this.pincodeRepo.findOne({ where: { pincode } });
    if (existing) {
      if (!existing.is_active) {
        existing.is_active = true;
        return this.pincodeRepo.save(existing);
      }
      return existing;
    }
    const nuevo = this.pincodeRepo.create({ pincode });
    return this.pincodeRepo.save(nuevo);
  }

  async removePincode(pincode: number): Promise<void> {
    await this.pincodeRepo.update({ pincode }, { is_active: false });
  }

  async getAllPincodes(): Promise<AllowedPincode[]> {
    return this.pincodeRepo.find();
  }

  getCharges() {
    return {
      platform_fees: Number(
        this.configService.get<number>('PLATFORM_FEES', 10),
      ),
      kitchen_fees: Number(this.configService.get<number>('KITCHEN_FEES', 15)),
      delivery_fees: Number(
        this.configService.get<number>('DELIVERY_FEES', 20),
      ),
    };
  }

  /**
   * Three independent fields: currently active window, configured start (UTC), configured end (UTC).
   * Optional `hours` / `time` query (> 0): `is_under_maintainance` true only if a fixed end exists and
   * at least that many hours remain (unchanged behavior).
   */
  async getIsUnderMaintenance(
    hoursFilter?: string,
  ): Promise<MaintenanceStatus> {
    const rawUntil = await this.redisService.client.get(MAINTENANCE_UNTIL_KEY);
    const rawFrom = await this.redisService.client.get(MAINTENANCE_FROM_KEY);
    const openEndedRaw = await this.redisService.client.get(
      MAINTENANCE_OPEN_ENDED_KEY,
    );
    const openEnded = openEndedRaw === '1';
    const startsAt = this.parseMaintenanceStartsAt(rawFrom);
    const endsAt = this.parseMaintenanceEndsAtForResponse(
      rawUntil,
      openEnded,
      rawFrom,
    );
    let is_under_maintainance = this.computeUnderMaintenance(rawUntil, rawFrom);
    const h = this.parseHoursQuery(hoursFilter);
    if (
      h != null &&
      h > 0 &&
      is_under_maintainance &&
      rawUntil != null &&
      rawUntil !== '0' &&
      !openEnded
    ) {
      const until = parseInt(rawUntil, 10);
      if (!Number.isNaN(until) && until > Date.now()) {
        const remainingMs = until - Date.now();
        is_under_maintainance = remainingMs >= h * 3600000;
      }
    }
    return {
      is_under_maintainance,
      maintenance_starts_at: startsAt,
      maintenance_ends_at: endsAt,
    };
  }

  /**
   * POST: when true, optional `starts_at` (UTC ISO) sets when the window begins; optional positive
   * `hours`/`time` (hours wins) sets a fixed length from that start. Omit duration → open-ended after start.
   */
  async setIsUnderMaintenance(input: {
    is_under_maintainance: boolean;
    starts_at?: string;
    hours?: number;
    time?: number;
  }): Promise<MaintenanceStatus> {
    if (!input.is_under_maintainance) {
      await this.clearMaintenanceKeys();
      return {
        is_under_maintainance: false,
        maintenance_starts_at: null,
        maintenance_ends_at: null,
      };
    }
    const fromMs = this.resolveMaintenanceStartMs(input.starts_at);
    const h = this.resolveBodyHours(input.hours, input.time);
    if (h != null && h > 0) {
      const until = fromMs + h * 3600000;
      await this.redisService.client.set(MAINTENANCE_UNTIL_KEY, String(until));
      await this.redisService.client.set(MAINTENANCE_FROM_KEY, String(fromMs));
      await this.redisService.client.del(MAINTENANCE_OPEN_ENDED_KEY);
      return {
        is_under_maintainance: this.computeUnderMaintenance(
          String(until),
          String(fromMs),
        ),
        maintenance_starts_at: new Date(fromMs).toISOString(),
        maintenance_ends_at: new Date(until).toISOString(),
      };
    }
    const far = String(fromMs + FAR_FUTURE_MS);
    await this.redisService.client.set(MAINTENANCE_UNTIL_KEY, far);
    await this.redisService.client.set(MAINTENANCE_FROM_KEY, String(fromMs));
    await this.redisService.client.set(MAINTENANCE_OPEN_ENDED_KEY, '1');
    return {
      is_under_maintainance: this.computeUnderMaintenance(far, String(fromMs)),
      maintenance_starts_at: new Date(fromMs).toISOString(),
      maintenance_ends_at: null,
    };
  }

  private resolveBodyHours(hours?: number, time?: number): number | null {
    const raw = hours ?? time;
    if (raw === undefined || raw === null || Number.isNaN(raw)) return null;
    return raw;
  }

  private async clearMaintenanceKeys(): Promise<void> {
    await this.redisService.client.del(
      MAINTENANCE_UNTIL_KEY,
      MAINTENANCE_FROM_KEY,
      MAINTENANCE_OPEN_ENDED_KEY,
    );
  }

  private resolveMaintenanceStartMs(startsAt?: string): number {
    if (startsAt == null || String(startsAt).trim() === '') {
      return Date.now();
    }
    const ms = Date.parse(startsAt);
    if (Number.isNaN(ms)) {
      throw new BadRequestException(
        'starts_at must be a valid ISO 8601 datetime',
      );
    }
    return ms;
  }

  private parseMaintenanceStartsAt(raw: string | null): string | null {
    if (raw == null || raw === '') return null;
    const from = parseInt(raw, 10);
    if (Number.isNaN(from)) return null;
    return new Date(from).toISOString();
  }

  /** Concrete end instant for clients; null when off, open-ended, or legacy far-future indefinite. */
  private parseMaintenanceEndsAtForResponse(
    rawUntil: string | null,
    openEnded: boolean,
    rawFrom?: string | null,
  ): string | null {
    if (rawUntil == null || rawUntil === '0' || openEnded) return null;
    const until = parseInt(rawUntil, 10);
    if (Number.isNaN(until)) return null;
    // Before we stored `open_ended`, indefinite mode used only a far-future `until`.
    const noFrom = rawFrom == null || rawFrom === '';
    if (noFrom && until - Date.now() > 10 * 365 * 24 * 3600000) {
      return null;
    }
    return new Date(until).toISOString();
  }

  private computeUnderMaintenance(
    rawUntil: string | null,
    rawFrom?: string | null,
  ): boolean {
    if (rawUntil == null) return false;
    if (rawUntil === '0') return false;
    const until = parseInt(rawUntil, 10);
    if (Number.isNaN(until)) return false;
    const now = Date.now();
    if (now >= until) return false;
    if (rawFrom != null && rawFrom !== '') {
      const from = parseInt(rawFrom, 10);
      if (!Number.isNaN(from) && now < from) return false;
    }
    return true;
  }

  private parseHoursQuery(q?: string): number | null {
    if (q === undefined || q === null || String(q).trim() === '') return null;
    const n = parseFloat(String(q));
    if (Number.isNaN(n) || n < 0) return null;
    return n;
  }
}
