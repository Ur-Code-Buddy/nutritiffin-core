import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class OrderItemRatingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;
}
