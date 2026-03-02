import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.role.enum';
import { ResponseMapper } from '../common/utils/response.mapper';

@Controller('deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DELIVERY_DRIVER)
export class DeliveriesController {
  constructor(
    private readonly deliveriesService: DeliveriesService,
    private readonly usersService: UsersService,
  ) { }

  @Get('credits')
  async getCredits(@Request() req: any) {
    const user = await this.usersService.findOneById(req.user.userId);
    return { credits: user ? user.credits : 0 };
  }

  @Get('available')
  async findAllAvailable() {
    const orders = await this.deliveriesService.findAllAvailable();
    return orders.map((order) => ResponseMapper.toDriverDeliveryView(order));
  }

  @Get('my-orders')
  async findMyOrders(@Request() req: any) {
    const orders = await this.deliveriesService.findMyOrders(req.user.userId);
    return orders.map((order) => ResponseMapper.toDriverDeliveryView(order));
  }

  @Patch(':id/accept')
  acceptDelivery(@Param('id') id: string, @Request() req: any) {
    return this.deliveriesService.acceptDelivery(id, req.user.userId);
  }

  @Patch(':id/pick-up')
  pickUpDelivery(@Param('id') id: string, @Request() req: any) {
    return this.deliveriesService.pickUpDelivery(id, req.user.userId);
  }

  @Patch(':id/out-for-delivery')
  outForDelivery(@Param('id') id: string, @Request() req: any) {
    return this.deliveriesService.outForDelivery(id, req.user.userId);
  }

  @Patch(':id/finish')
  finishDelivery(@Param('id') id: string, @Request() req: any) {
    return this.deliveriesService.finishDelivery(id, req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const order = await this.deliveriesService.findOne(id);
    // Note: deliveriesService.findOne checks for existence but not necessarily driver assignment for 'viewing'.
    // If we want strict 'my delivery' check, we should add it.
    // However, if the driver is viewing an 'available' order (before accepting), they need to see it too.
    // So we assume if it's found via delivery service, it's viewable by driver.
    return ResponseMapper.toDriverDeliveryView(order);
  }
}
