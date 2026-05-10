import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, MaxLength, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType }   from '../enums/property-type.enum';
import { PropertyStatus } from '../enums/property-status.enum';
import { BillingCycle }   from '../enums/billing-cycle.enum';

export class FilterPropertyDto {

  // ── Full-text search ────────────────────────────────────────────────────

  @ApiPropertyOptional({
    example: 'Kololo apartment',
    description: 'Free-text search applied to title and area fields (case-insensitive).',
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  search?: string;

  // ── Structured filters ──────────────────────────────────────────────────

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  districtId?: string;

  @ApiPropertyOptional({ enum: PropertyType })
  @IsEnum(PropertyType)
  @IsOptional()
  type?: PropertyType;

  @ApiPropertyOptional({ enum: PropertyStatus })
  @IsEnum(PropertyStatus)
  @IsOptional()
  status?: PropertyStatus;

  @ApiPropertyOptional({ enum: BillingCycle })
  @IsEnum(BillingCycle)
  @IsOptional()
  billingCycle?: BillingCycle;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxPrice?: number;

  /**
   * Filter by exact room count.
   * Replaces the former `bedrooms` filter.
   */
  @ApiPropertyOptional({ example: 3, description: 'Exact number of rooms to filter by.' })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  numberOfRooms?: number;

  // ── Geospatial filtering (mobile app) ───────────────────────────────────

  @ApiPropertyOptional({ description: 'User current latitude' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  lat?: number;

  @ApiPropertyOptional({ description: 'User current longitude' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  lng?: number;

  @ApiPropertyOptional({ description: 'Search radius in kilometres', default: 5 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  radius?: number;

  // ── Pagination ──────────────────────────────────────────────────────────

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 15, description: 'Results per page (max 100).' })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}