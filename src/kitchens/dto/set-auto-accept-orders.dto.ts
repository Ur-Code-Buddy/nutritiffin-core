import { IsBoolean } from 'class-validator';

export class SetAutoAcceptOrdersDto {
  @IsBoolean()
  enabled: boolean;
}
