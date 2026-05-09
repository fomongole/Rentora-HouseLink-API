import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';

import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { DistrictsModule } from './modules/districts/districts.module';
import { DistrictsService } from './modules/districts/districts.service';
import { PropertiesModule } from './modules/properties/properties.module';
import { MediaModule } from './modules/media/media.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { HostelRoomsModule } from './modules/hostel-rooms/hostel-rooms.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

import { envValidationSchema } from './config/env.validation';

import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,

        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',

        autoLogging: {
          ignore: (req) => req.url === '/api/v1/health',
        },

        serializers: {
          req(req) {
            return {
              method: req.method,
              url: req.url,
            };
          },
        },
      },
    }),

    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000, // 1 minute
        limit: 100,  // 100 requests/minute/IP
      },
    ]),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get<number>('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('NODE_ENV') !== 'production',
        // synchronize: true,
        logging: config.get('NODE_ENV') === 'development',
        ssl:
          config.get('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false,
        extra: {
          max: 20,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        },
      }),
    }),

    HealthModule,

    // ── Global modules (services available everywhere via DI) ─────────────
    AuditLogsModule,
    NotificationsModule, // @Global — NotificationsService injectable in all modules

    // ── Feature modules ───────────────────────────────────────────────────
    UsersModule,
    AuthModule,
    ContactsModule,
    DistrictsModule,
    PropertiesModule,
    MediaModule,
    HostelRoomsModule,
    BookingsModule,
    ComplaintsModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly districtsService: DistrictsService) {}

  async onModuleInit() {
    await this.districtsService.seed();
  }
}