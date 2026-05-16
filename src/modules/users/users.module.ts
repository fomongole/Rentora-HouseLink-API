import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersCleanupTask } from './tasks/users-cleanup.task';
import { TokenBlacklistModule } from '../token-blacklist/token-blacklist.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    TokenBlacklistModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret') as string,
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn') as unknown as number,
        },
      }),
    }),
  ],
  providers: [UsersService, UsersCleanupTask],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}