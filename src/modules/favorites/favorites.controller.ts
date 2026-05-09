import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { SyncFavoritesDto } from './dto/sync-favorites.dto';

@ApiTags('Favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all my saved properties' })
  findAll(@CurrentUser() user: User) {
    return this.favoritesService.findAllForUser(user.id);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync locally favorited properties to the account' })
  sync(@CurrentUser() user: User, @Body() dto: SyncFavoritesDto) {
    return this.favoritesService.sync(user.id, dto);
  }

  @Post(':propertyId')
  @ApiOperation({ summary: 'Toggle save/unsave for a property' })
  toggle(@CurrentUser() user: User, @Param('propertyId') propertyId: string) {
    return this.favoritesService.toggle(user.id, propertyId);
  }
}