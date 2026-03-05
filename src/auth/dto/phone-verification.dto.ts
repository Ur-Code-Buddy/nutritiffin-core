import { IsString, IsNotEmpty } from 'class-validator';

export class PhoneVerificationDto {
    @IsString()
    @IsNotEmpty()
    verificationId: string;

    @IsString()
    @IsNotEmpty()
    otp: string;
}
