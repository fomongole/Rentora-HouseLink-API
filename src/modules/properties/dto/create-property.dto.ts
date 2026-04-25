import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsOptional, IsUUID, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType } from '../enums/property-type.enum';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Spacious 2BR Apartment in Kololo' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'A modern apartment with great views...' })
  @IsString()
  description: string;

  @ApiProperty({ enum: PropertyType })
  @IsEnum(PropertyType)
  type: PropertyType;

  @ApiProperty({ example: 800000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  bedrooms: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  bathrooms: number;

  @ApiProperty({ example: 'Kololo' })
  @IsString()
  area: string;

  @ApiPropertyOptional({ example: 'Plot 23, Acacia Avenue' })
  @IsString()
  @IsOptional()
  address: string;

  @ApiProperty({ example: 'uuid-of-landlord' })
  @IsUUID()
  landlordId: string;

  @ApiProperty({ example: 'uuid-of-district' })
  @IsUUID()
  districtId: string;

  @ApiPropertyOptional({ example: ['Water', 'Electricity', 'WiFi', 'Parking'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenities: string[];
}