import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AllowedPincode } from './common/entities/allowed-pincode.entity';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(AllowedPincode)
    private readonly pincodeRepo: Repository<AllowedPincode>,
  ) { }

  async onModuleInit() {
    // Seed default pincodes if none exist
    const count = await this.pincodeRepo.count();
    if (count === 0) {
      const defaults = [605001, 605002, 605003];
      const entities = defaults.map(p => this.pincodeRepo.create({ pincode: p }));
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
      where: { pincode: pin, is_active: true }
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
      platform_fees: Number(this.configService.get<number>('PLATFORM_FEES', 10)),
      kitchen_fees: Number(this.configService.get<number>('KITCHEN_FEES', 15)),
      delivery_fees: Number(this.configService.get<number>('DELIVERY_FEES', 20)),
    };
  }
}
