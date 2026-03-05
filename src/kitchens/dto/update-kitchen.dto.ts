import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateKitchenDto } from './create-kitchen.dto';

export class UpdateKitchenDto extends PartialType(OmitType(CreateKitchenDto, ['owner_id'] as const)) { }
