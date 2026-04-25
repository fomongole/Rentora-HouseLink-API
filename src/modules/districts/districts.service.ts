import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { District } from './entities/district.entity';

@Injectable()
export class DistrictsService {
  constructor(
    @InjectRepository(District)
    private readonly districtRepository: Repository<District>,
  ) {}

  async findAll(): Promise<District[]> {
    return this.districtRepository.find({ order: { name: 'ASC' } });
  }

  async seed(): Promise<void> {
    const count = await this.districtRepository.count();
    if (count > 0) return; // already seeded

    const districts = [
      { name: 'Kampala', region: 'Central' },
      { name: 'Wakiso', region: 'Central' },
      { name: 'Mukono', region: 'Central' },
      { name: 'Entebbe', region: 'Central' },
      { name: 'Jinja', region: 'Eastern' },
      { name: 'Mbale', region: 'Eastern' },
      { name: 'Gulu', region: 'Northern' },
      { name: 'Lira', region: 'Northern' },
      { name: 'Mbarara', region: 'Western' },
      { name: 'Kabale', region: 'Western' },
      { name: 'Fort Portal', region: 'Western' },
      { name: 'Masaka', region: 'Central' },
      { name: 'Mityana', region: 'Central' },
      { name: 'Lugazi', region: 'Central' },
      { name: 'Soroti', region: 'Eastern' },
    ];

    await this.districtRepository.save(
      districts.map((d) => this.districtRepository.create(d)),
    );

    console.log('✅ Districts seeded successfully');
  }

  async findOne(id: string): Promise<District> {
    const district = await this.districtRepository.findOne({ where: { id } });
    if (!district) throw new NotFoundException('District not found');
        return district;
}
}