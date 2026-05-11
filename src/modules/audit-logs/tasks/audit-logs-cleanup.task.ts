import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AuditLogsCleanupTask {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  @Cron('0 2 * * *') // 2 AM daily
  async purgeOldLogs(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90); // keep 90 days

    await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .from(AuditLog)
      .where('createdAt < :cutoff', { cutoff })
      .execute();
  }
}