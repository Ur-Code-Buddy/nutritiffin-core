import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

const ROUTES_URL =
  'https://routes.googleapis.com/directions/v2:computeRoutes';

export type LatLng = { latitude: number; longitude: number };

export type ComputeRouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
};

@Injectable()
export class GoogleRoutesService {
  private readonly logger = new Logger(GoogleRoutesService.name);

  constructor(private readonly config: ConfigService) {}

  getApiKey(): string | undefined {
    return this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim() || undefined;
  }

  /**
   * Parses protobuf JSON duration like "123s" or "3.5s" to seconds.
   */
  static parseDurationSeconds(duration: string | undefined): number {
    if (!duration || typeof duration !== 'string') return 0;
    const m = duration.match(/^([\d.]+)s$/);
    if (!m) return 0;
    return parseFloat(m[1]);
  }

  async computeRoute(
    origin: LatLng,
    destination: LatLng,
  ): Promise<ComputeRouteResult | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.warn('GOOGLE_MAPS_API_KEY is not set; skipping route');
      return null;
    }

    const body = {
      origin: {
        location: {
          latLng: {
            latitude: origin.latitude,
            longitude: origin.longitude,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
        },
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      polylineQuality: 'OVERVIEW',
    };

    try {
      const { data } = await axios.post<{
        routes?: Array<{
          distanceMeters?: number;
          duration?: string;
          polyline?: { encodedPolyline?: string };
        }>;
      }>(ROUTES_URL, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
        },
        timeout: 15000,
      });

      const route = data.routes?.[0];
      if (!route?.distanceMeters || !route.polyline?.encodedPolyline) {
        return null;
      }

      const durationSeconds = GoogleRoutesService.parseDurationSeconds(
        route.duration,
      );

      return {
        distanceMeters: route.distanceMeters,
        durationSeconds,
        encodedPolyline: route.polyline.encodedPolyline,
      };
    } catch (err) {
      const ax = err as AxiosError<{ error?: { message?: string } }>;
      const msg =
        ax.response?.data?.error?.message || ax.message || 'Routes request failed';
      this.logger.warn(`Google Routes API error: ${msg}`);
      return null;
    }
  }
}
