import {
  Controller,
  Get,
  Post,
  Body,
  ServiceUnavailableException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RedisService } from './redis/redis.service';

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
