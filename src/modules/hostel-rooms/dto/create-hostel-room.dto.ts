import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HostelRoomType } from '../enums/hostel-room-type.enum';

export class CreateHostelRoomDto {
  @ApiProperty({ example: '101' })
  @IsString()
  roomNumber: string;

  @ApiProperty({ enum: HostelRoomType })
  @IsEnum(HostelRoomType)
  type: HostelRoomType;

  @ApiProperty({ example: 350000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  floor?: number;

  @ApiPropertyOptional({ example: 'Corner room with good natural light' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: ['En-suite', 'Desk', 'Wardrobe'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenities?: string[];
}
