import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHash } from 'crypto';
import type { Redis } from 'ioredis';

import type { LatLng } from './google-routes.service';

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const GEOCODE_CACHE_PREFIX = 'geocode:addr:';
const GEOCODE_CACHE_TTL_SEC = 7 * 24 * 3600;

@Injectable()
export class GoogleGeocodingService {
  private readonly logger = new Logger(GoogleGeocodingService.name);

  constructor(private readonly config: ConfigService) {}

  private cacheKey(address: string): string {
    const hash = createHash('sha256').update(address.trim().toLowerCase()).digest('hex');
    return `${GEOCODE_CACHE_PREFIX}${hash}`;
  }

  async resolveAddress(
    redis: Redis,
    address: string,
  ): Promise<LatLng | null> {
    const trimmed = address?.trim();
    if (!trimmed) return null;

    const key = this.cacheKey(trimmed);
    try {
      const cached = await redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as LatLng;
        if (
          typeof parsed.latitude === 'number' &&
          typeof parsed.longitude === 'number'
        ) {
          return parsed;
        }
      }
    } catch {
      /* ignore cache read errors */
    }

    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim();
    if (!apiKey) {
      return null;
    }

    try {
      const { data } = await axios.get<{
        status: string;
        results?: Array<{
          geometry?: { location?: { lat: number; lng: number } };
        }>;
      }>(GEOCODE_URL, {
        params: { address: trimmed, key: apiKey },
        timeout: 12000,
      });

      if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
        this.logger.warn(
          `Geocoding failed for address: status=${data.status}`,
        );
        return null;
      }

      const loc = data.results[0].geometry.location;
      const latLng: LatLng = {
        latitude: loc.lat,
        longitude: loc.lng,
      };

      try {
        await redis.setex(key, GEOCODE_CACHE_TTL_SEC, JSON.stringify(latLng));
      } catch {
        /* ignore cache write */
      }

      return latLng;
    } catch (e) {
      this.logger.warn(`Geocoding request error: ${(e as Error).message}`);
      return null;
    }
  }
}
