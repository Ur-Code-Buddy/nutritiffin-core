import { GoogleRoutesService } from './google-routes.service';
import { ConfigService } from '@nestjs/config';

describe('GoogleRoutesService', () => {
  describe('parseDurationSeconds', () => {
    it('parses integer seconds', () => {
      expect(GoogleRoutesService.parseDurationSeconds('120s')).toBe(120);
    });

    it('parses fractional seconds', () => {
      expect(GoogleRoutesService.parseDurationSeconds('3.5s')).toBe(3.5);
    });

    it('returns 0 for invalid input', () => {
      expect(GoogleRoutesService.parseDurationSeconds(undefined)).toBe(0);
      expect(GoogleRoutesService.parseDurationSeconds('')).toBe(0);
      expect(GoogleRoutesService.parseDurationSeconds('nope')).toBe(0);
    });
  });

  describe('getApiKey', () => {
    it('returns undefined when unset', () => {
      const config = {
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as ConfigService;
      const svc = new GoogleRoutesService(config);
      expect(svc.getApiKey()).toBeUndefined();
    });

    it('trims whitespace', () => {
      const config = {
        get: jest.fn().mockReturnValue('  abc  '),
      } as unknown as ConfigService;
      const svc = new GoogleRoutesService(config);
      expect(svc.getApiKey()).toBe('abc');
    });
  });
});
