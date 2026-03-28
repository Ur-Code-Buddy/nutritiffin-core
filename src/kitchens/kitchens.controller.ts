import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { KitchensService } from './kitchens.service';
import { UsersService } from '../users/users.service';
import { CreateKitchenDto } from './dto/create-kitchen.dto';
import { UpdateKitchenDto } from './dto/update-kitchen.dto';
import { SetAutoAcceptOrdersDto } from './dto/set-auto-accept-orders.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.role.enum';

@Controller('kitchens')
export class KitchensController {
  constructor(
    private readonly kitchensService: KitchensService,
    private readonly usersService: UsersService,
  ) {}

  @Get('credits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.KITCHEN_OWNER)
  async getCredits(@Request() req: any) {
    const user = await this.usersService.findOneById(req.user.userId);
    return { credits: user ? user.credits : 0 };
  }

  /** Toggle automatic acceptance of new orders (kitchen owner only; one kitchen per owner). */
  @Patch('me/auto-accept-orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.KITCHEN_OWNER)
  setAutoAcceptOrders(
    @Request() req: any,
    @Body() dto: SetAutoAcceptOrdersDto,
  ) {
    return this.kitchensService.setAutoAcceptOrders(
      req.user.userId,
      dto.enabled,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.KITCHEN_OWNER)
  create(@Request() req: any, @Body() createKitchenDto: CreateKitchenDto) {
    // Enforce that the owner_id matches the authenticated user
    // or just overwrite it to be safe
    createKitchenDto.owner_id = req.user.userId;
    return this.kitchensService.create(createKitchenDto);
  }

  @Get()
  findAll() {
    return this.kitchensService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.kitchensService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.KITCHEN_OWNER)
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateKitchenDto: UpdateKitchenDto,
  ) {
    // Ensure user owns this kitchen
    const kitchen = await this.kitchensService.findOne(id);
    if (kitchen.owner_id !== req.user.userId) {
      throw new BadRequestException('You can only update your own kitchen');
    }
    return this.kitchensService.update(id, updateKitchenDto);
  }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.kitchensService.remove(id);
  // }
}
