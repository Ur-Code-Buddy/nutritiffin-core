import { OperatingHoursDto } from './operating-hours.dto';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  ValidateNested,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class CreateKitchenDto {
  @IsOptional()
  owner_id: string; // Set by controller from JWT

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @IsOptional()
  details: any;

  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  operating_hours: OperatingHoursDto;

  @IsString()
  @IsOptional()
  image_url: string;

  /** Pickup pin for driver navigation (WGS84). */
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  is_active: boolean;

  @IsOptional()
  is_menu_visible: boolean;

  @IsOptional()
  @IsBoolean()
  auto_accept_orders?: boolean;

  @IsOptional()
  @IsBoolean()
  is_veg?: boolean;
}
