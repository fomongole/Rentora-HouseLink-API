import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ComplaintStatus } from '../enums/complaint-status.enum';

export class UpdateComplaintStatusDto {
  @ApiProperty({ enum: ComplaintStatus, description: 'New status for the complaint' })
  @IsEnum(ComplaintStatus)
  status: ComplaintStatus;

  @ApiPropertyOptional({ example: 'Contacted the property owner. Issue being addressed.' })
  @IsString()
  @IsOptional()
  adminNotes?: string;

  @ApiPropertyOptional({
    example: 'We have investigated your complaint and spoken to the owner. The issue has been resolved.',
    description: 'Reply shown to the renter in their notification and sent via email if they provided one.',
  })
  @IsString()
  @IsOptional()
  adminReply?: string;
}