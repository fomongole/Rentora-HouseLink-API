import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LandlordsService } from './landlords.service';
import { CreateLandlordDto } from './dto/create-landlord.dto';
import { UpdateLandlordDto } from './dto/update-landlord.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Landlords')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('landlords')
export class LandlordsController {
  constructor(private readonly landlordsService: LandlordsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new landlord (admin only)' })
  create(@Body() dto: CreateLandlordDto) {
    return this.landlordsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all landlords (admin only)' })
  findAll() {
    return this.landlordsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single landlord by ID (admin only)' })
  findOne(@Param('id') id: string) {
    return this.landlordsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a landlord (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateLandlordDto) {
    return this.landlordsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a landlord (admin only)' })
  remove(@Param('id') id: string) {
    return this.landlordsService.remove(id);
  }
}