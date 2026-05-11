import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsCleanupTask } from './tasks/audit-logs-cleanup.task';

@Global() // Makes AuditLogsService injectable everywhere without re-importing the module
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditLogsService, AuditLogsCleanupTask],
  controllers: [AuditLogsController],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}