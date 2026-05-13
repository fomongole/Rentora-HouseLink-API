import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property }                from './entities/property.entity';
import { PropertyImage }           from './entities/property-image.entity';
import { PropertiesService }       from './properties.service';
import { PropertiesController }    from './properties.controller';
import { PropertiesSchedulerTask } from './tasks/properties-scheduler.task';
import { DistrictsModule }         from '../districts/districts.module';
import { ContactsModule }          from '../contacts/contacts.module';
import { UniversitiesModule }      from '../universities/universities.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Property, PropertyImage]),
    ContactsModule,
    DistrictsModule,
    UniversitiesModule, // provides UniversitiesService for FK resolution + seeding
  ],
  providers: [
    PropertiesService,
    PropertiesSchedulerTask, // nightly cron — expires featured listings automatically
  ],
  controllers: [PropertiesController],
  exports: [PropertiesService],
})
export class PropertiesModule {}