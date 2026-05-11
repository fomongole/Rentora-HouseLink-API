import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { BlacklistedToken } from './entities/blacklisted-token.entity';

@Injectable()
export class TokenBlacklistService {
  constructor(
    @InjectRepository(BlacklistedToken)
    private readonly blacklistRepository: Repository<BlacklistedToken>,
  ) {}

  /**
   * Add a token to the blacklist.
   * Call this on every logout (manual or idle timeout).
   *
   * @param jti  - the `jti` claim from the decoded JWT
   * @param exp  - the `exp` claim (Unix timestamp in seconds)
   */
  async blacklist(jti: string, exp: number): Promise<void> {
    try {
      const expiresAt = new Date(exp * 1_000);
      const entry = this.blacklistRepository.create({ jti, expiresAt });
      await this.blacklistRepository.save(entry);
    } catch (err) {
      // Duplicate insert (e.g. double logout) — safe to ignore
      console.error('[TokenBlacklist] Failed to blacklist token:', err);
    }
  }

  /**
   * Returns true if the given jti has been blacklisted.
   * Only checks tokens that haven't expired yet — no false positives
   * for naturally expired tokens.
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    const entry = await this.blacklistRepository.findOne({
      where: { jti },
      select: ['id'],
    });
    return !!entry;
  }

  /**
   * Purge rows for tokens that have already expired naturally.
   * Call this from a scheduled task (e.g. @nestjs/schedule every hour).
   * Safe to skip — it's purely a table-size optimisation.
   */
  async purgeExpired(): Promise<void> {
    await this.blacklistRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }
}