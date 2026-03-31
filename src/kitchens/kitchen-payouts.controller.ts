import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.role.enum';
import { KitchenPayoutsService } from './kitchen-payouts.service';
import { UpsertKitchenBankDetailsDto } from './dto/upsert-kitchen-bank-details.dto';
import { KitchenWithdrawDto } from './dto/kitchen-withdraw.dto';

// Also `kitchen` so routes work when a reverse proxy strips `/api` before the app (path becomes `/kitchen/...`).
@Controller(['api/kitchen', 'kitchen'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.KITCHEN_OWNER)
export class KitchenPayoutsController {
  constructor(private readonly kitchenPayoutsService: KitchenPayoutsService) {}

  @Get('bank-details')
  async getBankDetails(@Request() req: { user: { userId: string } }) {
    return this.kitchenPayoutsService.getBankDetailsForOwner(req.user.userId);
  }

  @Patch('bank-details')
  upsertBankDetails(
    @Request() req: { user: { userId: string } },
    @Body() dto: UpsertKitchenBankDetailsDto,
  ) {
    return this.kitchenPayoutsService.upsertBankDetails(req.user.userId, dto);
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.OK)
  withdraw(
    @Request() req: { user: { userId: string } },
    @Body() dto: KitchenWithdrawDto,
  ) {
    return this.kitchenPayoutsService.requestWithdraw(req.user.userId, dto);
  }
}
