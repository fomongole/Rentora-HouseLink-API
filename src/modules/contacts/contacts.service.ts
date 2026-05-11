import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactsDto } from './dto/filter-contacts.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../audit-logs/enums/audit-action.enum';
import { AuditEntity } from '../audit-logs/enums/audit-entity.enum';
import { User } from '../users/entities/user.entity';
import { EmailService } from '../email/email.service';

/**
 * Normalize optional string fields — convert empty strings to undefined
 * so the DB receives NULL instead of '', preventing unique constraint
 * violations on nationalId and email when multiple contacts have no value.
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
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
  ) {}

  // ── Uniqueness guard ──────────────────────────────────────────────────────
  // excludeId is passed on updates so a contact isn't flagged against itself.
  private async assertUnique(
    fields: {
      phone?: string;
      email?: string;
      nationalId?: string;
      whatsapp?: string;
    },
    excludeId?: string,
  ): Promise<void> {
    const checks = [
      { field: 'phone',      value: fields.phone,      message: 'Phone number already in use' },
      { field: 'whatsapp',   value: fields.whatsapp,   message: 'WhatsApp number already in use' },
      { field: 'email',      value: fields.email,      message: 'Email already in use' },
      { field: 'nationalId', value: fields.nationalId, message: 'National ID already in use' },
    ];

    for (const { field, value, message } of checks) {
      if (!value) continue;
      const existing = await this.contactRepository.findOne({
        where: { [field]: value },
      });
      if (existing && existing.id !== excludeId) {
        throw new ConflictException(message);
      }
    }
  }

  async create(dto: CreateContactDto, performedBy: User): Promise<Contact> {
    const normalized = normalizeOptionalStrings(dto);

    await this.assertUnique({
      phone:      normalized.phone,
      whatsapp:   normalized.whatsapp,
      email:      normalized.email,
      nationalId: normalized.nationalId,
    });

    const contact = this.contactRepository.create(normalized);
    const saved = await this.contactRepository.save(contact);

    await this.auditLogsService.log({
      action: AuditAction.CREATE,
      entity: AuditEntity.CONTACT,
      entityId: saved.id,
      entityTitle: `${saved.name} (${saved.role})`,
      performedBy,
    });

    if (saved.email) {
      void this.emailService.sendContactWelcome(saved.email, saved.name, saved.role);
    }

    return saved;
  }

  async findAll(filters: FilterContactsDto = {}) {
    const { search, role, page = 1, limit = 20 } = filters;

    const query = this.contactRepository
      .createQueryBuilder('contact')
      .where('contact.isActive = :isActive', { isActive: true })
      .orderBy('contact.createdAt', 'DESC');

    if (search) {
      query.andWhere(
        '(LOWER(contact.name) LIKE :search OR contact.phone LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    if (role) {
      query.andWhere('contact.role = :role', { role });
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

  async findOne(id: string): Promise<Contact> {
    const contact = await this.contactRepository.findOne({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(id: string, dto: UpdateContactDto, performedBy: User): Promise<Contact> {
    const contact = await this.findOne(id);
    const normalized = normalizeOptionalStrings(dto);

    await this.assertUnique(
      {
        phone:      normalized.phone,
        whatsapp:   normalized.whatsapp,
        email:      normalized.email,
        nationalId: normalized.nationalId,
      },
      id,
    );

    Object.assign(contact, normalized);
    const saved = await this.contactRepository.save(contact);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE,
      entity: AuditEntity.CONTACT,
      entityId: saved.id,
      entityTitle: `${saved.name} (${saved.role})`,
      performedBy,
      metadata: { changes: dto },
    });

    return saved;
  }

  async remove(id: string, performedBy: User): Promise<{ message: string }> {
    const contact = await this.findOne(id);
    contact.isActive = false;
    await this.contactRepository.save(contact);

    await this.auditLogsService.log({
      action: AuditAction.DELETE,
      entity: AuditEntity.CONTACT,
      entityId: contact.id,
      entityTitle: `${contact.name} (${contact.role})`,
      performedBy,
    });

    return { message: 'Contact deactivated successfully' };
  }
}