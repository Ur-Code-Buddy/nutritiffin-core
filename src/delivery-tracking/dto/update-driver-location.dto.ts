import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UpdateDriverLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @IsNumber()
  heading?: number;
}
