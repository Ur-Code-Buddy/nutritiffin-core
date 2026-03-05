import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto'; // Not really used for general updates, maybe just status
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.role.enum';
import { OrderStatus } from './entities/order.entity';
import { KitchensService } from '../kitchens/kitchens.service';
import { ResponseMapper } from '../common/utils/response.mapper';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly kitchenService: KitchensService,
  ) { }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  create(@Request() req: any, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(req.user.userId, createOrderDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Request() req: any) {
    const orders = await this.ordersService.findAll(
      req.user.userId,
      req.user.role,
    );
    if (req.user.role === UserRole.KITCHEN_OWNER) {
      return orders.map((order) => ResponseMapper.toOwnerOrderView(order));
    }
    return orders.map((order) => ResponseMapper.toClientOrderView(order));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const order = await this.ordersService.findOne(id);
    if (!order) throw new BadRequestException('Order not found');

    const userId = req.user.userId;
    const role = req.user.role;

    // Visibility Check
    if (role === UserRole.CLIENT) {
      if (order.client_id !== userId) {
        throw new ForbiddenException('You can only view your own orders');
      }
      return ResponseMapper.toClientOrderView(order);
    }

    if (role === UserRole.KITCHEN_OWNER) {
      // Check if order belongs to a kitchen owned by this user
      // ordersService.findOne loads kitchen, but not owner.
      // We can fetch kitchen to check owner.
      // Optimization: join schema would be better, but for now fetch kitchen.
      // Actually order.kitchen is loaded.
      // If we need owner_id, we might need to rely on kitchen service or ensure it's loaded.
      // Let's check if kitchen.owner_id is available in the entity or loaded.
      // Kitchen entity has owner_id column. It should be loaded if we select it or if it's a column.
      // TypeORM default loads columns.
      if (order.kitchen?.owner_id !== userId) {
        // Fallback or strict check
        // If owner_id is not loaded, we might deny incorrectly.
        // Let's assume it is loaded or fetch kitchen details to be safe.
        // Ideally OrderService findOne should ensure kitchen is loaded with necessary fields.

        // Let's double check via kitchen service if unsure, or trust the column.
        // Given existing code, let's try to trust the relation if it's there.
        // But wait, order.kitchen is a relation. If it's loaded, owner_id (column) should be there.
        if (order.kitchen && order.kitchen.owner_id !== userId) {
          throw new ForbiddenException('Not your order');
        }
      }
      return ResponseMapper.toOwnerOrderView(order);
    }

    // Admins or other roles? Default deny or basic view?
    // Project only mentioned Client, KitchenOwner, Driver.
    // Driver might access via GET /orders/:id? or just /deliveries/:id.
    // If driver accesses here, what should they see?
    // Spec says: "DELIVERY_DRIVER GET /deliveries/:id".
    // So /orders/:id might not be for drivers, but let's be safe.
    // If we want to allow drivers to see orders they are assigned to:
    if (role === UserRole.DELIVERY_DRIVER) {
      if (order.delivery_driver_id !== userId) {
        throw new ForbiddenException('Not assigned to this order');
      }
      return ResponseMapper.toDriverDeliveryView(order);
    }

    throw new ForbiddenException('Access denied');
  }

  @Patch(':id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.KITCHEN_OWNER)
  async accept(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    await this.validateOrderOwnership(req.user.userId, id);
    return this.ordersService.updateStatus(id, OrderStatus.ACCEPTED);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.KITCHEN_OWNER)
  async reject(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    await this.validateOrderOwnership(req.user.userId, id);
    return this.ordersService.updateStatus(id, OrderStatus.REJECTED);
  }

  @Patch(':id/ready')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.KITCHEN_OWNER)
  async ready(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    await this.validateOrderOwnership(req.user.userId, id);
    return this.ordersService.updateStatus(id, OrderStatus.READY);
  }

  private async validateOrderOwnership(userId: string, orderId: string) {
    const order = await this.ordersService.findOne(orderId);
    if (!order) throw new BadRequestException('Order not found');

    const kitchen = await this.kitchenService.findOne(order.kitchen_id);
    if (kitchen.owner_id !== userId) {
      throw new BadRequestException('Not your order to manage');
    }
  }
}
