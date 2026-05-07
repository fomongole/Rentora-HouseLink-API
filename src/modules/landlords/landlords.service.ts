import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Landlord } from './entities/landlord.entity';
import { CreateLandlordDto } from './dto/create-landlord.dto';
import { UpdateLandlordDto } from './dto/update-landlord.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../audit-logs/enums/audit-action.enum';
import { AuditEntity } from '../audit-logs/enums/audit-entity.enum';
import { User } from '../users/entities/user.entity';
import { FilterLandlordsDto } from './dto/filter-landlords.dto';

/**
 * Normalize optional string fields — convert empty strings to undefined
 * so the DB receives NULL instead of '', preventing unique constraint
 * violations on nationalId and email when multiple landlords have no value.
 */
function normalizeOptionalStrings<T extends object>(dto: T): T {
  const result = { ...dto } as Record<string, unknown>;
  const optionalFields = ['email', 'nationalId', 'whatsapp', 'physicalAddress', 'notes'];
  for (const field of optionalFields) {
    if (result[field] === '') {
      result[field] = undefined;
    }
  }
  return result as T;
}

@Injectable()
export class LandlordsService {
  constructor(
    @InjectRepository(Landlord)
    private readonly landlordRepository: Repository<Landlord>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateLandlordDto, performedBy: User): Promise<Landlord> {
    const normalized = normalizeOptionalStrings(dto);
    const landlord = this.landlordRepository.create(normalized);
    const saved = await this.landlordRepository.save(landlord);

    await this.auditLogsService.log({
      action: AuditAction.CREATE,
      entity: AuditEntity.LANDLORD,
      entityId: saved.id,
      entityTitle: saved.name,
      performedBy,
    });

    return saved;
  }

  async findAll(filters: FilterLandlordsDto = {}) {
    const { search, page = 1, limit = 20 } = filters;

    const query = this.landlordRepository
      .createQueryBuilder('landlord')
      .where('landlord.isActive = :isActive', { isActive: true })
      .orderBy('landlord.createdAt', 'DESC');

    if (search) {
      query.andWhere(
        '(LOWER(landlord.name) LIKE :search OR landlord.phone LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    const total = await query.getCount();
    const data = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Landlord> {
    const landlord = await this.landlordRepository.findOne({ where: { id } });
    if (!landlord) throw new NotFoundException('Landlord not found');
    return landlord;
  }

  async update(id: string, dto: UpdateLandlordDto, performedBy: User): Promise<Landlord> {
    const landlord = await this.findOne(id);
    const normalized = normalizeOptionalStrings(dto);
    Object.assign(landlord, normalized);
    const saved = await this.landlordRepository.save(landlord);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE,
      entity: AuditEntity.LANDLORD,
      entityId: saved.id,
      entityTitle: saved.name,
      performedBy,
      metadata: { changes: dto },
    });

    return saved;
  }

  async remove(id: string, performedBy: User): Promise<{ message: string }> {
    const landlord = await this.findOne(id);
    landlord.isActive = false;
    await this.landlordRepository.save(landlord);

    await this.auditLogsService.log({
      action: AuditAction.DELETE,
      entity: AuditEntity.LANDLORD,
      entityId: landlord.id,
      entityTitle: landlord.name,
      performedBy,
    });

    return { message: 'Landlord deactivated successfully' };
  }
}