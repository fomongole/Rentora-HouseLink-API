import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { SyncFavoritesDto } from './dto/sync-favorites.dto';

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
   * Race-condition safe: a simultaneous POST /favorites/sync (triggered on
   * login) can insert the same (userId, propertyId) row between our findOne
   * and our save, causing a unique-constraint violation (PG code 23505).
   * We catch that specific error and treat it as "already saved = true"
   * instead of letting it bubble up as a 500.
   */
  async toggle(userId: string, propertyId: string) {
    const existing = await this.favoriteRepository.findOne({
      where: { userId, propertyId },
    });

    if (existing) {
      await this.favoriteRepository.remove(existing);
      return { saved: false };
    }

    try {
      const favorite = this.favoriteRepository.create({ userId, propertyId });
      await this.favoriteRepository.save(favorite);
      return { saved: true };
    } catch (error: any) {
      // PostgreSQL unique_violation code.
      // Happens when syncFavorites (POST /favorites/sync on login) and
      // toggleFavorite (fire-and-forget from the app) run concurrently
      // and both try to insert the same row.
      const isUniqueViolation =
        error?.code === '23505' ||          // pg driver
        error?.constraint !== undefined;    // TypeORM wraps it with constraint

      if (isUniqueViolation) {
        // The row was inserted by the concurrent request — that's fine,
        // the property IS now saved.
        return { saved: true };
      }

      // Any other DB error re-throws so it still surfaces properly.
      throw error;
    }
  }

  /**
   * Syncs local favorites from the mobile app.
   * Uses INSERT ... ON CONFLICT DO NOTHING to handle duplicates efficiently.
   * Safe to call multiple times — idempotent by design.
   */
  async sync(userId: string, dto: SyncFavoritesDto) {
    if (dto.propertyIds.length === 0) return { synced: 0 };

    const values = dto.propertyIds.map((id) => ({ userId, propertyId: id }));

    const result = await this.favoriteRepository
      .createQueryBuilder()
      .insert()
      .into(Favorite)
      .values(values)
      .orIgnore() // ON CONFLICT (userId, propertyId) DO NOTHING
      .execute();

    return { synced: result.identifiers.length };
  }
}