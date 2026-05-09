import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BookingSyncItem {
  @IsUUID()
  id: string;

  @IsString()
  cancellationToken: string;
}

export class SyncBookingsDto {
  @ApiProperty({
    description: 'Array of booking objects containing ID and cancellationToken',
    example: [{ id: '...', cancellationToken: '123456' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingSyncItem)
  bookings: BookingSyncItem[];
}