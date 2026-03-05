import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
} from 'class-validator';

export class CreateFoodItemDto {
  @IsOptional()
  kitchen_id: string; // Set by controller

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsNumber()
  @Min(1)
  price: number;

  @IsString()
  @IsOptional()
  image_url: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  max_daily_orders: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availability_days?: string[];

  @IsOptional()
  @IsBoolean()
  is_veg?: boolean;
}
