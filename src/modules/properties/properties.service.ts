import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property }            from './entities/property.entity';
import { CreatePropertyDto }   from './dto/create-property.dto';
import { UpdatePropertyDto }   from './dto/update-property.dto';
import { FilterPropertyDto }   from './dto/filter-property.dto';
import { PropertyStatus }      from './enums/property-status.enum';
import { ContactsService }     from '../contacts/contacts.service';
import { DistrictsService }    from '../districts/districts.service';
import { AuditLogsService }    from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditAction }         from '../audit-logs/enums/audit-action.enum';
import { AuditEntity }         from '../audit-logs/enums/audit-entity.enum';
import { User }                from '../users/entities/user.entity';
import {
  stripInapplicableFields,
  validateBillingCycle,
} from './utils/property-field-rules';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    private readonly contactsService: ContactsService,
    private readonly districtsService: DistrictsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Create ──────────────────────────────────────────────────────────────

  async create(dto: CreatePropertyDto, performedBy: User): Promise<Property> {
    const cycleError = validateBillingCycle(dto.type, dto.billingCycle);
    if (cycleError) throw new BadRequestException(cycleError);

    const contact  = await this.contactsService.findOne(dto.contactId);
    const district = await this.districtsService.findOne(dto.districtId);

    const cleanedDto = stripInapplicableFields(
      { ...dto } as Record<string, unknown>,
      dto.type,
    );

    const property = this.propertyRepository.create({
      ...cleanedDto,
      contact,
      district,
    });

    const saved = await this.propertyRepository.save(property);

    await this.auditLogsService.log({
      action: AuditAction.CREATE,
      entity: AuditEntity.PROPERTY,
      entityId: saved.id,
      entityTitle: saved.title,
      performedBy,
    });

    // Broadcast to all active renters — fire and forget
    void this.notificationsService.sendNewPropertyBroadcast({
      propertyId:    saved.id,
      propertyTitle: saved.title,
      type:          saved.type,
      price:         Number(saved.price),
      area:          saved.area,
    });

    return saved;
  }

  // ── Find all (paginated + filtered) ────────────────────────────────────

  async findAll(filters: FilterPropertyDto) {
    const {
      districtId, type, status, billingCycle,
      minPrice, maxPrice, numberOfRooms, search,
      lat, lng, radius = 5,
      page = 1, limit = 15,
    } = filters;

    // Hard cap: prevent accidental full-table dumps via the API
    const safeLimit = Math.min(limit, 100);

    const query = this.propertyRepository
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.contact',  'contact')
      .leftJoinAndSelect('property.district', 'district')
      .leftJoinAndSelect('property.images',   'images');

    if (districtId)    query.andWhere('district.id = :districtId', { districtId });
    if (type)          query.andWhere('property.type = :type', { type });
    if (status)        query.andWhere('property.status = :status', { status });
    if (billingCycle)  query.andWhere('property.billingCycle = :billingCycle', { billingCycle });
    if (minPrice)      query.andWhere('property.price >= :minPrice', { minPrice });
    if (maxPrice)      query.andWhere('property.price <= :maxPrice', { maxPrice });

    if (numberOfRooms) {
      query.andWhere('property.numberOfRooms = :numberOfRooms', { numberOfRooms });
    }

    if (search) {
      // Server-side full-text search — case-insensitive, matches title or area
      query.andWhere(
        '(LOWER(property.title) LIKE LOWER(:search) OR LOWER(property.area) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    if (lat && lng) {
      const haversine = `(
        6371 * acos(
          cos( radians(:lat) )
          * cos( radians( property.latitude ) )
          * cos( radians( property.longitude ) - radians(:lng) )
          + sin( radians(:lat) ) * sin( radians( property.latitude ) )
        )
      )`;
      query.andWhere(`${haversine} <= :radius`, { lat, lng, radius });
      query.orderBy(haversine, 'ASC');
    } else {
      query.orderBy('property.createdAt', 'DESC');
    }

    const total = await query.getCount();
    const data  = await query
      .skip((page - 1) * safeLimit)
      .take(safeLimit)
      .getMany();

    return {
      data,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  // ── Find one ────────────────────────────────────────────────────────────

  async findOne(id: string): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: { id },
      relations: ['contact', 'district', 'images'],
    });

    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  // ── Update ──────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdatePropertyDto, performedBy: User): Promise<Property> {
    const property = await this.findOne(id);

    const resolvedType         = dto.type         ?? property.type;
    const resolvedBillingCycle = dto.billingCycle  ?? property.billingCycle ?? undefined;

    const cycleError = validateBillingCycle(resolvedType, resolvedBillingCycle);
    if (cycleError) throw new BadRequestException(cycleError);

    if (dto.contactId) {
      property.contact = await this.contactsService.findOne(dto.contactId);
    }
    if (dto.districtId) {
      property.district = await this.districtsService.findOne(dto.districtId);
    }

    const cleanedDto = stripInapplicableFields(
      { ...dto } as Record<string, unknown>,
      resolvedType,
    );

    Object.assign(property, cleanedDto);
    const saved = await this.propertyRepository.save(property);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE,
      entity: AuditEntity.PROPERTY,
      entityId: saved.id,
      entityTitle: saved.title,
      performedBy,
      metadata: { changes: dto },
    });

    return saved;
  }

  // ── Status helpers ──────────────────────────────────────────────────────

  /**
   * Directly set the property status.
   * Used internally by BookingsService. Not exposed as a public endpoint.
   */
  async setStatus(id: string, status: PropertyStatus): Promise<void> {
    await this.propertyRepository.update(id, { status });
  }

  async toggleStatus(id: string, performedBy: User): Promise<Property> {
    const property       = await this.findOne(id);
    const previousStatus = property.status;

    property.status =
      property.status === PropertyStatus.AVAILABLE
        ? PropertyStatus.RENTED
        : PropertyStatus.AVAILABLE;

    const saved = await this.propertyRepository.save(property);

    await this.auditLogsService.log({
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.PROPERTY,
      entityId: saved.id,
      entityTitle: saved.title,
      performedBy,
      metadata: { from: previousStatus, to: saved.status },
    });

    return saved;
  }

  // ── Soft-delete / restore ───────────────────────────────────────────────

  async remove(id: string, performedBy: User): Promise<{ message: string }> {
    const property = await this.findOne(id);
    await this.propertyRepository.softRemove(property);

    await this.auditLogsService.log({
      action: AuditAction.DELETE,
      entity: AuditEntity.PROPERTY,
      entityId: property.id,
      entityTitle: property.title,
      performedBy,
    });

    return { message: 'Property deleted successfully' };
  }

  async restore(id: string, performedBy: User): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: { id },
      withDeleted: true,
      relations: ['contact', 'district', 'images'],
    });

    if (!property) throw new NotFoundException('Property not found');
    if (!property.deletedAt) throw new NotFoundException('Property is not deleted');

    await this.propertyRepository.restore(id);

    await this.auditLogsService.log({
      action: AuditAction.RESTORE,
      entity: AuditEntity.PROPERTY,
      entityId: property.id,
      entityTitle: property.title,
      performedBy,
    });

    return this.findOne(id);
  }

  // ── Analytics ───────────────────────────────────────────────────────────

  async incrementViewCount(id: string): Promise<void> {
    await this.propertyRepository.increment({ id }, 'viewCount', 1);
  }

  async recordEnquiry(id: string): Promise<{ message: string }> {
    await this.findOne(id);
    await this.propertyRepository.increment({ id }, 'enquiryCount', 1);
    return { message: 'Enquiry recorded' };
  }

  async getStats() {
    const total     = await this.propertyRepository.count();
    const available = await this.propertyRepository.count({ where: { status: PropertyStatus.AVAILABLE } });
    const rented    = await this.propertyRepository.count({ where: { status: PropertyStatus.RENTED } });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const addedThisWeek = await this.propertyRepository
      .createQueryBuilder('property')
      .where('property.createdAt >= :sevenDaysAgo', { sevenDaysAgo })
      .getCount();

    const topViewed = await this.propertyRepository.find({
      order: { viewCount: 'DESC' },
      take: 5,
      relations: ['district'],
    });

    const topEnquired = await this.propertyRepository.find({
      order: { enquiryCount: 'DESC' },
      take: 5,
      relations: ['district'],
    });

    const occupancyRate = total > 0 ? Math.round((rented / total) * 100) : 0;

    const byTypeRaw: { type: string; count: string }[] =
      await this.propertyRepository
        .createQueryBuilder('property')
        .select('property.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('property.type')
        .getRawMany();

    const byType: Record<string, number> = {};
    for (const row of byTypeRaw) {
      byType[row.type] = Number(row.count);
    }

    return {
      total,
      available,
      rented,
      occupancyRate,
      addedThisWeek,
      topViewed,
      topEnquired,
      byType,
    };
  }
}