import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Landlord } from './entities/landlord.entity';
import { LandlordsService } from './landlords.service';
import { LandlordsController } from './landlords.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Landlord])],
  providers: [LandlordsService],
  controllers: [LandlordsController],
  exports: [LandlordsService],
})
export class LandlordsModule {}