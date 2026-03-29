import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ForceThrottle } from '../common/decorators/force-throttle.decorator';
import { DeliveriesService } from './deliveries.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.role.enum';
import { OrderStatus } from '../orders/entities/order.entity';
import { ResponseMapper } from '../common/utils/response.mapper';
import { FinishDeliveryDto } from './dto/finish-delivery.dto';
import { DeliveryTrackingService } from '../delivery-tracking/delivery-tracking.service';
import { UpdateDriverLocationDto } from '../delivery-tracking/dto/update-driver-location.dto';

@Controller('deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DELIVERY_DRIVER)
export class DeliveriesController {
  constructor(
    private readonly deliveriesService: DeliveriesService,
    private readonly deliveryTrackingService: DeliveryTrackingService,
  ) {}

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

  @Patch(':id/location')
  @ForceThrottle()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  updateLocation(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: UpdateDriverLocationDto,
  ) {
    return this.deliveryTrackingService.updateDriverLocation(
      id,
      req.user.userId,
      body,
    );
  }

  @Patch(':id/finish')
  finishDelivery(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: FinishDeliveryDto,
  ) {
    return this.deliveriesService.finishDelivery(
      id,
      req.user.userId,
      body.otp,
    );
  }

  @Get(':id')
  @Roles(UserRole.DELIVERY_DRIVER, UserRole.ADMIN)
  async findOne(@Param('id') id: string, @Request() req: any) {
    const order = await this.deliveriesService.findOne(id);

    if (req.user.role === UserRole.ADMIN) {
      return {
        id: order.id,
        user: order.client?.username,
        kitchen: order.kitchen?.name,
        status: order.status,
        items: order.items?.map((i) => `${i.food_item?.name} x${i.quantity}`),
        driver: order.delivery_driver?.name || null,
        destination: order.client?.address,
        estimated_delivery: order.scheduled_for,
        created_at: order.created_at,
      };
    }

    // Check ownership: driver is assigned OR it's unassigned & available
    if (order.delivery_driver_id !== req.user.userId) {
      if (order.delivery_driver_id !== null) {
        throw new ForbiddenException('Not assigned to this delivery');
      }
      if (
        order.status !== OrderStatus.ACCEPTED &&
        order.status !== OrderStatus.READY
      ) {
        throw new ForbiddenException('Delivery is not available');
      }
    }

    return ResponseMapper.toDriverDeliveryView(order);
  }
}
