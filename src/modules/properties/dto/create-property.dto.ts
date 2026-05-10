import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsEnum, IsNumber, IsOptional,
  IsUUID, IsArray, IsBoolean, IsDateString,
  Min, IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType }       from '../enums/property-type.enum';
import { FurnishingStatus }   from '../enums/furnishing-status.enum';
import { BillingCycle }       from '../enums/billing-cycle.enum';
import { ResidentialSubtype } from '../enums/residential-subtype.enum';
import { HotelCategory }      from '../enums/hotel-category.enum';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Spacious 3-Room Apartment in Kololo' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'A well-maintained apartment with modern finishes...' })
  @IsString()
  description: string;

  @ApiProperty({ enum: PropertyType })
  @IsEnum(PropertyType)
  type: PropertyType;

  /**
   * Required when type = RESIDENTIAL_HOUSE.
   * SINGLE = one bedroom / bedsitter, DOUBLE = two bedrooms.
   */
  @ApiPropertyOptional({ enum: ResidentialSubtype })
  @IsEnum(ResidentialSubtype)
  @IsOptional()
  residentialSubtype?: ResidentialSubtype;

  @ApiProperty({ example: 800000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  /**
   * The period this price applies to.
   * Required for all types except HOSTEL (billing cycle is set per room).
   * Allowed values depend on property type — enforced server-side.
   */
  @ApiPropertyOptional({ enum: BillingCycle })
  @IsEnum(BillingCycle)
  @IsOptional()
  billingCycle?: BillingCycle;

  /**
   * Total number of rooms in the property.
   * Replaces the former `bedrooms` + `bathrooms` pair.
   * Not applicable to HOSTEL (stripped server-side — individual rooms managed
   * via the HostelRooms module).
   */
  @ApiPropertyOptional({
    example: 3,
    description: 'Number of rooms in this property. Not used for HOSTEL type.',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  numberOfRooms?: number;

  /**
   * HOSTEL only — the maximum number of HostelRoom entries that can be
   * registered under this property.
   * NULL / omitted = no cap enforced.
   */
  @ApiPropertyOptional({
    example: 20,
    description:
      'HOSTEL only: maximum number of rooms that can be added to this hostel. ' +
      'Leave empty for no cap.',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  totalRooms?: number;

  /**
   * HOTEL_LODGE only — service-tier category.
   */
  @ApiPropertyOptional({
    enum: HotelCategory,
    description: 'HOTEL_LODGE only: property category (ORDINARY | VIP | VVIP).',
  })
  @IsEnum(HotelCategory)
  @IsOptional()
  hotelCategory?: HotelCategory;

  @ApiProperty({ example: 'Kololo' })
  @IsString()
  area: string;

  @ApiPropertyOptional({ example: 'Plot 23, Acacia Avenue' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 0.3326 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ example: 32.5825 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({ enum: FurnishingStatus })
  @IsEnum(FurnishingStatus)
  @IsOptional()
  furnishing?: FurnishingStatus;

  @ApiPropertyOptional({ example: 500000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  securityDeposit?: number;

  @ApiPropertyOptional({ example: '2025-08-01' })
  @IsDateString()
  @IsOptional()
  availableFrom?: string;

  @ApiPropertyOptional({ example: 3, description: 'Floor / level number (0 = ground floor)' })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  floor?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  parkingAvailable?: boolean;

  /**
   * The contact (owner or agent) managing this property.
   */
  @ApiProperty({ example: 'uuid-of-contact' })
  @IsUUID()
  contactId: string;

  @ApiProperty({ example: 'uuid-of-district' })
  @IsUUID()
  districtId: string;

  @ApiPropertyOptional({ example: ['Water', 'Electricity', 'WiFi', 'Security'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenities?: string[];
}