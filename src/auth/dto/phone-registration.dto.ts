import { IsString, IsNotEmpty } from 'class-validator';

export class PhoneRegistrationDto {
    @IsString()
    @IsNotEmpty()
    mobileNumber: string;

    @IsString()
    @IsNotEmpty()
    countryCode: string;
}
