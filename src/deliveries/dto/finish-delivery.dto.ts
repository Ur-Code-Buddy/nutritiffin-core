import { IsString, Length, Matches } from 'class-validator';

export class FinishDeliveryDto {
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'otp must be 4 digits' })
  otp: string;
}
