import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsInt,
  IsDateString,
  Min,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  food_item_id: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  kitchen_id: string;

  // scheduled_for is handled by logic as "tomorrow", but client might send it or just we enforce it.
  // Requirement: "Orders are placed one day in advance".
  // Let's enforce implementation to calculate "tomorrow" or validate provided date.
  // For simplicity, let client request it, and we validate strictly.
  @IsDateString()
  @IsNotEmpty()
  scheduled_for: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t.length === 0 ? undefined : t;
  })
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
