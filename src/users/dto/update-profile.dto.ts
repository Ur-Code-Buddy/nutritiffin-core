import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsUrl,
  MaxLength,
  ValidateIf,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  current_password: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  address?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone_number?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  pincode?: string;

  /** Delivery coordinates for live tracking / routing (WGS84). Omit to leave unchanged; send `null` to clear. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  /** Full URL (e.g. S3) to the user’s profile image. Send `null` to remove. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'profile_picture_url must be a valid http(s) URL' },
  )
  @MaxLength(2048)
  profile_picture_url?: string | null;
}
