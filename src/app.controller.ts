import {
  Controller,
  Get,
  Post,
  Body,
  ServiceUnavailableException,
  UnauthorizedException,
  InternalServerErrorException,
  Query,
  UseGuards,
  Delete,
  Param,
} from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RedisService } from './redis/redis.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { Roles } from './auth/roles.decorator';
import { UserRole } from './users/user.role.enum';
import { SetMaintenanceDto } from './common/dto/set-maintenance.dto';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    let database = 'down';
    let redis = 'down';

    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        database = 'up';
      }
    } catch (e) {
      // ignore, remains down
    }

    try {
      const ping = await this.redisService.ping();
      if (ping === 'PONG') {
        redis = 'up';
      }
    } catch (e) {
      // ignore, remains down
    }

    const isHealthy = database === 'up' && redis === 'up';
    const statusObj = {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      database,
      redis,
    };

    if (!isHealthy) {
      throw new ServiceUnavailableException(statusObj);
    }

    return statusObj;
  }

  @Get('uptime')
  getUptime() {
    return {
      current_version: this.configService.get('CURRENT_VERSION') || '0.0.1',
      uptime: process.uptime(),
    };
  }
  @Get('is-my-district-available')
  async isMyDistrictAvailable(@Query('pincode') pincode: string) {
    return this.appService.isDistrictAvailable(pincode);
  }

  @Post('is-my-district-available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async addPincode(@Body('pincode') pincode: number) {
    return this.appService.addPincode(pincode);
  }

  @Delete('is-my-district-available/:pincode')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async removePincode(@Param('pincode') pincode: number) {
    await this.appService.removePincode(pincode);
    return { success: true };
  }

  @Get('charges')
  getCharges() {
    return this.appService.getCharges();
  }

  @Get('is_under_maintainance')
  getIsUnderMaintenance(
    @Query('hours') hours?: string,
    @Query('time') time?: string,
  ) {
    return this.appService.getIsUnderMaintenance(hours ?? time);
  }

  @Post('is_under_maintainance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  setIsUnderMaintenance(@Body() body: SetMaintenanceDto) {
    return this.appService.setIsUnderMaintenance(body);
  }

  @Post('resetdb')
  async resetDb(@Body('pass') pass: string) {
    const superAdminPass = this.configService.get<string>(
      'SUPER_ADMIN_ACCESS_PASS',
    );
    if (!superAdminPass || pass !== superAdminPass) {
      throw new UnauthorizedException('Invalid pass');
    }

    try {
      const scriptPath = path.join(process.cwd(), 'scripts', 'reset-db.ts');
      const { stdout, stderr } = await execAsync(`npx ts-node "${scriptPath}"`);
      await this.dataSource.synchronize();
      return { message: 'Database reset successfully', stdout, stderr };
    } catch (error) {
      throw new InternalServerErrorException({
        message: 'Failed to reset database',
        error: error.message || error.toString(),
      });
    }
  }
}
