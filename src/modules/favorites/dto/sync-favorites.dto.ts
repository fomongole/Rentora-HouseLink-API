import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class SyncFavoritesDto {
  @ApiProperty({
    example: ['uuid-1', 'uuid-2'],
    description: 'Array of property IDs saved locally in shared_preferences',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  propertyIds: string[];
}