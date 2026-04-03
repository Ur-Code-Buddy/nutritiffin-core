import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class SetMaintenanceDto {
  @IsBoolean()
  is_under_maintainance: boolean;

  /**
   * When `is_under_maintainance` is true: UTC instant when the window starts (ISO 8601).
   * Omit → starts immediately. Can be in the future to schedule maintenance.
   */
  @IsOptional()
  @IsDateString()
  starts_at?: string;

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
