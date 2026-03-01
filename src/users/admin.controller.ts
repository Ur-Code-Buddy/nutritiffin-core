import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from './user.role.enum';
import { UsersService } from './users.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
    constructor(private readonly usersService: UsersService) { }

    @Get('users')
    async getAllUsers() {
        return this.usersService.findAll();
    }

    @Post('credits/add')
    async addCredits(@Body() body: { userId: string; amount: number }) {
        return this.usersService.addCredits(body.userId, body.amount);
    }

    @Post('credits/deduct')
    async deductCredits(@Body() body: { userId: string; amount: number }) {
        return this.usersService.deductCredits(body.userId, body.amount);
    }

    @Post('users/:id/disable')
    async disableUser(@Param('id') id: string) {
        return this.usersService.updateStatus(id, false);
    }

    @Post('users/:id/enable')
    async enableUser(@Param('id') id: string) {
        return this.usersService.updateStatus(id, true);
    }
}
