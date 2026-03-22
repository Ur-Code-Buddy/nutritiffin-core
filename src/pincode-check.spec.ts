import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RedisService } from './redis/redis.service';

describe('AppController (Pincode Check)', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { isInitialized: true, query: jest.fn() },
        },
        {
          provide: RedisService,
          useValue: { ping: jest.fn() },
        },
      ],
    }).compile();

    appController = module.get<AppController>(AppController);
    appService = module.get<AppService>(AppService);
  });

  describe('isMyDistrictAvailable', () => {
    it('should return true for allowed pincodes (string)', () => {
      expect(appController.isMyDistrictAvailable('605003')).toBe(true);
      expect(appController.isMyDistrictAvailable('605001')).toBe(true);
    });

    it('should return false for disallowed pincodes (string)', () => {
      expect(appController.isMyDistrictAvailable('605002')).toBe(false);
      expect(appController.isMyDistrictAvailable('110001')).toBe(false);
    });

    it('should return false for invalid input', () => {
        expect(appController.isMyDistrictAvailable(undefined as any)).toBe(false);
        expect(appController.isMyDistrictAvailable('')).toBe(false);
        expect(appController.isMyDistrictAvailable('abc')).toBe(false);
    });
  });
});
