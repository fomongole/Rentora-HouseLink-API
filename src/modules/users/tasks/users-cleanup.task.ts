import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from '../users.service';

/**
 * Nightly task that hard-deletes user accounts whose 30-day grace period
 * has expired.
 *
 * TypeORM cascades handle deletion of all related rows (bookings, favorites,
 * notifications, etc.) — make sure cascade: ['remove'] is set on those
 * relations, or add ON DELETE CASCADE to your FK constraints in migrations.
 */
@Injectable()
export class UsersCleanupTask {
  private readonly logger = new Logger(UsersCleanupTask.name);

  constructor(private readonly usersService: UsersService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeExpiredDeletions(): Promise<void> {
    this.logger.log('Running scheduled account purge...');
    try {
      const count = await this.usersService.purgeExpiredDeletions();
      if (count > 0) {
        this.logger.log(`Purged ${count} account(s) that passed their deletion grace period.`);
      } else {
        this.logger.debug('No accounts due for purge.');
      }
    } catch (err) {
      this.logger.error('Account purge task failed', err);
    }
  }
}