import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { FilterPropertyDto } from './dto/filter-property.dto';
import { PropertyStatus } from './enums/property-status.enum';
import { LandlordsService } from '../landlords/landlords.service';
import { DistrictsService } from '../districts/districts.service';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    private readonly landlordsService: LandlordsService,
    private readonly districtsService: DistrictsService,
  ) {}

  async create(dto: CreatePropertyDto): Promise<Property> {
    const landlord = await this.landlordsService.findOne(dto.landlordId);
    const district = await this.districtsService.findOne(dto.districtId);

    const property = this.propertyRepository.create({
      ...dto,
      landlord,
      district,
    });

    return this.propertyRepository.save(property);
  }

  async findAll(filters: FilterPropertyDto) {
    const { districtId, type, minPrice, maxPrice, bedrooms, page = 1, limit = 10 } = filters;

    const query = this.propertyRepository
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.landlord', 'landlord')
      .leftJoinAndSelect('property.district', 'district')
      .leftJoinAndSelect('property.images', 'images')
      .where('property.status = :status', { status: PropertyStatus.AVAILABLE });

    if (districtId) query.andWhere('district.id = :districtId', { districtId });
    if (type) query.andWhere('property.type = :type', { type });
    if (minPrice) query.andWhere('property.price >= :minPrice', { minPrice });
    if (maxPrice) query.andWhere('property.price <= :maxPrice', { maxPrice });
    if (bedrooms) query.andWhere('property.bedrooms = :bedrooms', { bedrooms });

    const total = await query.getCount();
    const data = await query
      .orderBy('property.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: { id },
      relations: ['landlord', 'district', 'images'],
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async update(id: string, dto: UpdatePropertyDto): Promise<Property> {
    const property = await this.findOne(id);

    if (dto.landlordId) {
      property.landlord = await this.landlordsService.findOne(dto.landlordId);
    }
    if (dto.districtId) {
      property.district = await this.districtsService.findOne(dto.districtId);
    }

    Object.assign(property, dto);
    return this.propertyRepository.save(property);
  }

  async toggleStatus(id: string): Promise<Property> {
    const property = await this.findOne(id);
    property.status =
      property.status === PropertyStatus.AVAILABLE
        ? PropertyStatus.RENTED
        : PropertyStatus.AVAILABLE;
    return this.propertyRepository.save(property);
  }

  async remove(id: string): Promise<{ message: string }> {
    const property = await this.findOne(id);
    await this.propertyRepository.remove(property);
    return { message: 'Property deleted successfully' };
  }
}