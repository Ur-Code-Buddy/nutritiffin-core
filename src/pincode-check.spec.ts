import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RedisService } from './redis/redis.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AllowedPincode } from './common/entities/allowed-pincode.entity';

describe('AppController (Pincode Check)', () => {
  let appController: AppController;
  let pincodeRepo: {
    findOne: jest.Mock;
    count: jest.Mock;
  };

  beforeEach(async () => {
    pincodeRepo = {
      count: jest.fn().mockResolvedValue(1),
      findOne: jest.fn().mockImplementation((opts: { where: { pincode: number; is_active?: boolean } }) => {
        const pin = opts?.where?.pincode;
        if (pin === 605003 || pin === 605001) {
          return Promise.resolve({ pincode: pin, is_active: true });
        }
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: getRepositoryToken(AllowedPincode),
          useValue: {
            ...pincodeRepo,
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            find: jest.fn(),
          },
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
  });

  describe('isMyDistrictAvailable', () => {
    it('should return true for allowed pincodes (string)', async () => {
      await expect(appController.isMyDistrictAvailable('605003')).resolves.toBe(true);
      await expect(appController.isMyDistrictAvailable('605001')).resolves.toBe(true);
    });

    it('should return false for disallowed pincodes (string)', async () => {
      await expect(appController.isMyDistrictAvailable('605002')).resolves.toBe(false);
      await expect(appController.isMyDistrictAvailable('110001')).resolves.toBe(false);
    });

    it('should return false for invalid input', async () => {
      await expect(appController.isMyDistrictAvailable(undefined as any)).resolves.toBe(false);
      await expect(appController.isMyDistrictAvailable('')).resolves.toBe(false);
      await expect(appController.isMyDistrictAvailable('abc')).resolves.toBe(false);
    });
  });
});
