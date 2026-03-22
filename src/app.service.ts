import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  private readonly pincodes_allowed = [605003, 605001];

  getHello(): string {
    return 'This is Nutri Tiffin!';
  }

  isDistrictAvailable(pincode: string): boolean {
    if (!pincode) return false;
    const pin = parseInt(pincode, 10);
    return this.pincodes_allowed.includes(pin);
  }

  getCharges() {
    return {
      platform_fees: Number(this.configService.get<number>('PLATFORM_FEES', 10)),
      kitchen_fees: Number(this.configService.get<number>('KITCHEN_FEES', 15)),
      delivery_fees: Number(this.configService.get<number>('DELIVERY_FEES', 20)),
    };
  }
}
