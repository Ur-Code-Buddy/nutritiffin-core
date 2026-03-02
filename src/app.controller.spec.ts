import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';
import { RedisService } from './redis/redis.service';

describe('AppController', () => {
  let appController: AppController;
  let configService: ConfigService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CURRENT_VERSION') return '1.0.0';
              return null;
            }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    configService = app.get<ConfigService>(ConfigService);
  });

  describe('root', () => {
    it('should return "This is Nutri Tiffin!"', () => {
      expect(appController.getHello()).toBe('This is Nutri Tiffin!');
    });
  });

  describe('uptime', () => {
    it('should return current version and uptime', () => {
      const result = appController.getUptime();
      expect(result).toHaveProperty('current_version', '1.0.0');
      expect(result).toHaveProperty('uptime');
      expect(typeof result.uptime).toBe('number');
    });

    it('should return default version if env var is missing', () => {
      jest.spyOn(configService, 'get').mockReturnValue(null);
      const result = appController.getUptime();
      expect(result.current_version).toBe('0.0.1');
    });
  });
});
