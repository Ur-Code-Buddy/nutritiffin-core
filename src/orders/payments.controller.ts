import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.role.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) { }

  @Post('initiate')
  initiate(@Request() req: any, @Body() createOrderDto: CreateOrderDto) {
    return this.paymentsService.initiate(req.user.userId, createOrderDto);
  }

  @Post('confirm')
  confirm(@Request() req: any, @Body() confirmDto: ConfirmPaymentDto) {
    return this.paymentsService.confirm(req.user.userId, confirmDto);
  }
}

