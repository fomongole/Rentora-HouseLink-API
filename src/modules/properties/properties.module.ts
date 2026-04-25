import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from './entities/property.entity';
import { PropertyImage } from './entities/property-image.entity';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { LandlordsModule } from '../landlords/landlords.module';
import { DistrictsModule } from '../districts/districts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Property, PropertyImage]),
    LandlordsModule,
    DistrictsModule,
  ],
  providers: [PropertiesService],
  controllers: [PropertiesController],
  exports: [PropertiesService],
})
export class PropertiesModule {}