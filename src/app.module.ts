import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { KitchensModule } from './kitchens/kitchens.module';
import { FoodItemsModule } from './food-items/food-items.module';
import { OrdersModule } from './orders/orders.module';
import { JobsModule } from './jobs/jobs.module';
import { CommonModule } from './common/common.module';
import { QueueModule } from './queue/queue.module';
import { UploadModule } from './upload/upload.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { RedisModule } from './redis/redis.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AllowedPincode } from './common/entities/allowed-pincode.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL');
        if (dbUrl) {
          return {
            type: 'postgres',
            url: dbUrl,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true, // Auto-create tables (disable in production)
          };
        }
        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true, // Auto-create tables (disable in production)
          ssl:
            configService.get<string>('DB_SSL') === 'true'
              ? { rejectUnauthorized: false }
              : undefined,
        };
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          tls: config.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('PRODUCTION') !== 'false';
        return [
          {
            name: 'default',
            ttl: 60000,
            limit: isProd ? 10 : 1000000,
          },
          {
            name: 'hourly',
            ttl: 3600000,
            limit: isProd ? 100 : 1000000,
          },
        ];
      },
    }),
    UsersModule,
    AuthModule,
    KitchensModule,
    FoodItemsModule,
    OrdersModule,
    JobsModule,
    CommonModule,
    UploadModule,
    DeliveriesModule,
    RedisModule,
    TransactionsModule,
    ReviewsModule,
    NotificationsModule,
    TypeOrmModule.forFeature([AllowedPincode]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule { }
