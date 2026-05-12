import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint } from './entities/complaint.entity';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { FilterComplaintsDto } from './dto/filter-complaints.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';
import { ComplaintStatus } from './enums/complaint-status.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { AuditAction } from '../audit-logs/enums/audit-action.enum';
import { AuditEntity } from '../audit-logs/enums/audit-entity.enum';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { PropertiesService } from '../properties/properties.service';

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectRepository(Complaint)
    private readonly complaintRepository: Repository<Complaint>,
    private readonly propertiesService: PropertiesService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateComplaintDto): Promise<Complaint> {
    let property: Property | null = null;

    if (dto.propertyId) {
      property = await this.propertiesService.findOne(dto.propertyId);
    }

    const complaint = this.complaintRepository.create({
      submitterName: dto.submitterName,
      submitterPhone: dto.submitterPhone,
      submitterEmail: dto.submitterEmail ?? null,
      userId: dto.userId ?? null,
      category: dto.category,
      description: dto.description,
      property,
    });

    return this.complaintRepository.save(complaint);
  }

  async findAll(filters: FilterComplaintsDto) {
    const { status, category, propertyId, page = 1, limit = 20 } = filters;

    const query = this.complaintRepository
      .createQueryBuilder('complaint')
      .leftJoinAndSelect('complaint.property', 'property')
      .orderBy('complaint.createdAt', 'DESC');

    if (status)     query.andWhere('complaint.status = :status', { status });
    if (category)   query.andWhere('complaint.category = :category', { category });
    if (propertyId) query.andWhere('property.id = :propertyId', { propertyId });

    const total = await query.getCount();
    const data  = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Complaint> {
    const complaint = await this.complaintRepository.findOne({
      where: { id },
      relations: ['property'],
    });
    if (!complaint) throw new NotFoundException('Complaint not found');
    return complaint;
  }

  async updateStatus(
    id: string,
    dto: UpdateComplaintStatusDto,
    performedBy: User,
  ): Promise<Complaint> {
    const complaint = await this.findOne(id);
    const previousStatus = complaint.status;

    if (complaint.status === dto.status) {
      throw new BadRequestException(`Complaint is already in status "${dto.status}".`);
    }

    complaint.status = dto.status;

    if (dto.adminNotes)  complaint.adminNotes  = dto.adminNotes;
    if (dto.adminReply)  complaint.adminReply  = dto.adminReply;

    const isClosingStatus =
      dto.status === ComplaintStatus.RESOLVED ||
      dto.status === ComplaintStatus.CLOSED;

    if (isClosingStatus) {
      complaint.resolvedAt     = new Date();
      complaint.resolvedByName = performedBy.name;
    } else {
      complaint.resolvedAt     = null;
      complaint.resolvedByName = null;
    }

    const saved = await this.complaintRepository.save(complaint);

    await this.auditLogsService.log({
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.COMPLAINT,
      entityId: saved.id,
      entityTitle: `Complaint by ${saved.submitterName} — ${saved.category}`,
      performedBy,
      metadata: { from: previousStatus, to: dto.status, hasReply: !!dto.adminReply },
    });

    // ── In-app notification — include reply text if provided ──────────────
    if (saved.userId) {
      void this.notificationsService.sendComplaintUpdated(saved.userId, {
        complaintId: saved.id,
        newStatus: dto.status,
        category: saved.category,
        adminReply: dto.adminReply,
      });
    }

    // ── Email — send to renter if they provided an email and admin replied ──
    if (saved.submitterEmail && dto.adminReply) {
      void this.emailService.sendComplaintReply(
        saved.submitterEmail,
        saved.submitterName,
        saved.category,
        dto.status,
        dto.adminReply,
      );
    }

    return saved;
  }

  async getStats() {
    const total      = await this.complaintRepository.count();
    const open       = await this.complaintRepository.count({ where: { status: ComplaintStatus.OPEN } });
    const inProgress = await this.complaintRepository.count({ where: { status: ComplaintStatus.IN_PROGRESS } });
    const resolved   = await this.complaintRepository.count({ where: { status: ComplaintStatus.RESOLVED } });
    const closed     = await this.complaintRepository.count({ where: { status: ComplaintStatus.CLOSED } });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thisWeek = await this.complaintRepository
      .createQueryBuilder('complaint')
      .where('complaint.createdAt >= :sevenDaysAgo', { sevenDaysAgo })
      .getCount();

    return { total, open, inProgress, resolved, closed, thisWeek };
  }
}