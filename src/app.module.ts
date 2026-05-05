import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { LandlordsModule } from './modules/landlords/landlords.module';
import { DistrictsModule } from './modules/districts/districts.module';
import { DistrictsService } from './modules/districts/districts.service';
import { PropertiesModule } from './modules/properties/properties.module';
import { MediaModule } from './modules/media/media.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
    }),
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
        // synchronize: process.env.NODE_ENV !== 'production',
        synchronize: true,
        logging: process.env.NODE_ENV === 'development',
      }),
    }),
    UsersModule,
    AuthModule,
    LandlordsModule,
    DistrictsModule,
    PropertiesModule,
    MediaModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly districtsService: DistrictsService) {}

  async onModuleInit() {
    await this.districtsService.seed();
  }
}