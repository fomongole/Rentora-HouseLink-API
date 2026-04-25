import {
  Controller, Post, Delete, Patch, Param,
  UseInterceptors, UploadedFiles, UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('properties/:propertyId/images')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @ApiOperation({ summary: 'Upload images to a property (admin only, max 8)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 8, { storage: memoryStorage() }))
  uploadImages(
    @Param('propertyId') propertyId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.mediaService.uploadImages(propertyId, files);
  }

  @Patch(':imageId/set-primary')
  @ApiOperation({ summary: 'Set an image as primary thumbnail (admin only)' })
  setPrimary(
    @Param('propertyId') propertyId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.mediaService.setPrimaryImage(propertyId, imageId);
  }

  @Delete(':imageId')
  @ApiOperation({ summary: 'Delete an image from a property (admin only)' })
  deleteImage(
    @Param('propertyId') propertyId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.mediaService.deleteImage(propertyId, imageId);
  }
}