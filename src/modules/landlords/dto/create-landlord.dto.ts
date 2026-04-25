import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateLandlordDto {
  @ApiProperty({ example: 'Joseph Kato' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: '+256701234567' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ example: '+256701234567' })
  @IsString()
  @IsOptional()
  whatsapp: string;

  @ApiPropertyOptional({ example: 'Prefers contact after 5pm' })
  @IsString()
  @IsOptional()
  notes: string;
}