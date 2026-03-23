import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class SetMaintenanceDto {
  @IsBoolean()
  is_under_maintainance: boolean;

  /** If `is_under_maintainance` is true and set, maintenance ends after this many hours. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hours?: number;

  /** Same as `hours`; `hours` wins when both are sent. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  time?: number;
}
