import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Landlord } from './entities/landlord.entity';
import { CreateLandlordDto } from './dto/create-landlord.dto';
import { UpdateLandlordDto } from './dto/update-landlord.dto';

@Injectable()
export class LandlordsService {
  constructor(
    @InjectRepository(Landlord)
    private readonly landlordRepository: Repository<Landlord>,
  ) {}

  async create(dto: CreateLandlordDto): Promise<Landlord> {
    const landlord = this.landlordRepository.create(dto);
    return this.landlordRepository.save(landlord);
  }

  async findAll(): Promise<Landlord[]> {
    return this.landlordRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Landlord> {
    const landlord = await this.landlordRepository.findOne({ where: { id } });
    if (!landlord) throw new NotFoundException('Landlord not found');
    return landlord;
  }

  async update(id: string, dto: UpdateLandlordDto): Promise<Landlord> {
    const landlord = await this.findOne(id);
    Object.assign(landlord, dto);
    return this.landlordRepository.save(landlord);
  }

  async remove(id: string): Promise<{ message: string }> {
    const landlord = await this.findOne(id);
    landlord.isActive = false;
    await this.landlordRepository.save(landlord);
    return { message: 'Landlord deactivated successfully' };
  }
}