import { Injectable, ConflictException } from '@nestjs/common';
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
   */
  async toggle(userId: string, propertyId: string) {
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
  }

  /**
   * Syncs local favorites from mobile app.
   * Uses "INSERT IGNORE" logic via QueryBuilder to handle duplicates efficiently.
   */
  async sync(userId: string, dto: SyncFavoritesDto) {
    if (dto.propertyIds.length === 0) return { synced: 0 };

    const values = dto.propertyIds.map((id) => ({ userId, propertyId: id }));

    const result = await this.favoriteRepository
      .createQueryBuilder()
      .insert()
      .into(Favorite)
      .values(values)
      .orIgnore() // If (userId, propertyId) exists, skip it
      .execute();

    return { synced: result.identifiers.length };
  }
}