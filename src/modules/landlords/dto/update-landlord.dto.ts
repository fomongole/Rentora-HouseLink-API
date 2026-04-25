import { PartialType } from '@nestjs/swagger';
import { CreateLandlordDto } from './create-landlord.dto';

export class UpdateLandlordDto extends PartialType(CreateLandlordDto) {}