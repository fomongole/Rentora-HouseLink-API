import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyImage } from '../properties/entities/property-image.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { CloudinaryProvider } from '../../config/cloudinary.config';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PropertyImage]),
    PropertiesModule,
  ],
  providers: [MediaService, CloudinaryProvider],
  controllers: [MediaController],
})
export class MediaModule {}