import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlacklistedToken } from './entities/blacklisted-token.entity';
import { TokenBlacklistService } from './token-blacklist.service';

@Global() // TokenBlacklistService injectable everywhere — same pattern as AuditLogsModule
@Module({
  imports: [TypeOrmModule.forFeature([BlacklistedToken])],
  providers: [TokenBlacklistService],
  exports: [TokenBlacklistService],
})
export class TokenBlacklistModule {}