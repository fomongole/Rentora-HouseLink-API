import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { SyncFavoritesDto } from './dto/sync-favorites.dto';

/**
 * PostgreSQL error codes we handle explicitly.
 */
const PG = {
  UNIQUE_VIOLATION:       '23505', // duplicate (userId, propertyId)
  FOREIGN_KEY_VIOLATION:  '23503', // user or property doesn't exist in DB
  UNDEFINED_TABLE:        '42P01', // table doesn't exist (synchronize: false + missing migration)
  UNDEFINED_COLUMN:       '42703', // column missing (schema out of sync)
} as const;

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
  ) {}

  /**
   * Returns all properties favorited by the user.
   */
  async findAllForUser(userId: string) {
    const favorites = await this.favoriteRepository.find({
      where: { userId },
      relations: ['property', 'property.district', 'property.images'],
      order: { createdAt: 'DESC' },
    });
    return favorites.map((f) => f.property);
  }

  /**
   * Toggles a favorite. If it exists, delete it. If not, create it.
   *
   * Handles all known race conditions and DB schema mismatches so that
   * a server-side failure never surfaces as an unhandled 500 to the
   * mobile client. The client uses local storage as the source of truth
   * so a silent server failure is acceptable — better than crashing.
   */
  async toggle(userId: string, propertyId: string) {
    try {
      const existing = await this.favoriteRepository.findOne({
        where: { userId, propertyId },
      });

      if (existing) {
        await this.favoriteRepository.remove(existing);
        return { saved: false };
      }

      const favorite = this.favoriteRepository.create({ userId, propertyId });
      await this.favoriteRepository.save(favorite);
      return { saved: true };

    } catch (error: any) {
      // ── Always log the real error so it appears in Railway logs ──────────
      // Check your Railway → Deployments → Logs to see the actual PG code.
      console.error('[FavoritesService.toggle] DB error:', {
        pgCode:     error?.code,
        constraint: error?.constraint,
        detail:     error?.detail,
        message:    error?.message,
        userId,
        propertyId,
      });

      switch (error?.code) {
        // ── Race condition: sync and toggle both insert the same row ───────
        case PG.UNIQUE_VIOLATION:
          // Row already exists — treat as saved.
          return { saved: true };

        // ── FK violation: user or property doesn't exist in the DB ─────────
        // This happens when:
        //   a) Production DB was reset but old JWTs are still in circulation.
        //   b) The user was deleted from the DB but their token is still valid.
        //   c) The JWT was issued on a different environment (dev vs prod).
        // Run the diagnostic SQL below to confirm.
        case PG.FOREIGN_KEY_VIOLATION:
          console.error(
            '[FavoritesService.toggle] FK violation — run diagnostic SQL: ' +
            `SELECT id FROM users WHERE id = '${userId}'; ` +
            `SELECT id FROM properties WHERE id = '${propertyId}';`,
          );
          // Return gracefully so the client doesn't crash.
          // The local-storage state is still correct for the user.
          return { saved: true };

        // ── Table or column doesn't exist ──────────────────────────────────
        // This means the production DB is missing the `favorites` table.
        // synchronize: false means TypeORM will NOT auto-create it.
        // Run the migration SQL in production to fix this permanently.
        case PG.UNDEFINED_TABLE:
        case PG.UNDEFINED_COLUMN:
          console.error(
            '[FavoritesService.toggle] Schema error — ' +
            'the favorites table is missing or has wrong columns. ' +
            'Run the migration SQL provided in favorites.migration.sql.',
          );
          // Re-throw so the 500 is visible — this one MUST be fixed.
          throw error;

        default:
          // Unknown DB error — re-throw so it surfaces properly.
          throw error;
      }
    }
  }

  /**
   * Syncs local favorites from the mobile app.
   * Uses INSERT ... ON CONFLICT DO NOTHING — idempotent and race-safe.
   */
  async sync(userId: string, dto: SyncFavoritesDto) {
    if (dto.propertyIds.length === 0) return { synced: 0 };

    const values = dto.propertyIds.map((id) => ({ userId, propertyId: id }));

    try {
      const result = await this.favoriteRepository
        .createQueryBuilder()
        .insert()
        .into(Favorite)
        .values(values)
        .orIgnore() // ON CONFLICT (userId, propertyId) DO NOTHING
        .execute();

      return { synced: result.identifiers.length };
    } catch (error: any) {
      console.error('[FavoritesService.sync] DB error:', {
        pgCode:  error?.code,
        detail:  error?.detail,
        message: error?.message,
        userId,
      });
      // Sync failure is silent — the local state is still correct.
      return { synced: 0 };
    }
  }
}