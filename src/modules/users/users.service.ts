import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { AuditAction } from '../audit-logs/enums/audit-action.enum';
import { AuditEntity } from '../audit-logs/enums/audit-entity.enum';

/** Grace period before a deletion request is permanently executed. */
const DELETION_GRACE_DAYS = 30;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  async create(
    name: string,
    email: string,
    password: string,
    role = UserRole.RENTER,
  ): Promise<User> {
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({ name, email, password: hashed, role });
    const saved = await this.userRepository.save(user);

    if (saved.role === UserRole.RENTER) {
      void this.notificationsService.sendWelcome(saved.id, saved.name);
    }

    return saved;
  }

  async createAdmin(dto: CreateAdminDto, performedBy: User): Promise<User> {
    const user = await this.create(
      dto.name,
      dto.email,
      dto.password,
      dto.role ?? UserRole.ADMIN,
    );

    await this.auditLogsService.log({
      action: AuditAction.CREATE,
      entity: AuditEntity.USER,
      entityId: user.id,
      entityTitle: user.name,
      performedBy,
      metadata: { role: user.role, email: user.email },
    });

    void this.emailService.sendAdminWelcome(user.email, user.name);

    return user;
  }

  async findAll(): Promise<Omit<User, 'password'>[]> {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });
    return users.map(({ password: _p, ...rest }) => rest as Omit<User, 'password'>);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.findById(userId);
    const oldEmail = user.email;

    if (dto.email && dto.email !== oldEmail) {
      const existing = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existing) throw new ConflictException('Email already in use');
    }

    Object.assign(user, dto);
    const saved = await this.userRepository.save(user);

    if (dto.email && dto.email !== oldEmail) {
      void this.emailService.sendEmailChanged(oldEmail, dto.email, saved.name);
    }

    const { password: _p, ...rest } = saved;
    return rest as Omit<User, 'password'>;
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    performedBy: User,
  ): Promise<{ message: string }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) throw new NotFoundException('User not found');

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) throw new BadRequestException('Current password is incorrect');

    const hashedNewPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepository.update(userId, { password: hashedNewPassword });

    await this.auditLogsService.log({
      action: AuditAction.PASSWORD_CHANGE,
      entity: AuditEntity.USER,
      entityId: user.id,
      entityTitle: user.name,
      performedBy,
    });

    void this.notificationsService.sendPasswordChanged(userId);
    void this.emailService.sendPasswordChanged(user.email, user.name);

    return { message: 'Password changed successfully' };
  }

  async toggleActive(
    id: string,
    performedBy: User,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.findById(id);

    if (user.id === performedBy.id) {
      throw new ConflictException('You cannot deactivate your own account');
    }

    user.isActive = !user.isActive;
    const saved = await this.userRepository.save(user);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE,
      entity: AuditEntity.USER,
      entityId: saved.id,
      entityTitle: saved.name,
      performedBy,
      metadata: { isActive: saved.isActive },
    });

    if (saved.isActive) {
      void this.notificationsService.sendAccountActivated(saved.id);
      void this.emailService.sendAccountActivated(saved.email, saved.name);
    } else {
      void this.notificationsService.sendAccountDeactivated(saved.id);
      void this.emailService.sendAccountDeactivated(saved.email, saved.name);
    }

    const { password: _p, ...rest } = saved;
    return rest as Omit<User, 'password'>;
  }

  /** Internal use only — called by the password-reset OTP flow. */
  async updatePasswordDirectly(userId: string, hashedPassword: string): Promise<void> {
    await this.userRepository.update(userId, { password: hashedPassword });
  }

  // ── Account deletion ────────────────────────────────────────────────────────

  /**
   * Marks the account for deletion after a grace period.
   *
   * - Sets scheduledPurgeAt = now + 30 days
   * - Does NOT hard-delete immediately (gives the user a safety net)
   * - The JWT strategy will reject this user on their next request,
   *   effectively forcing a logout
   * - The nightly cleanup task in users-cleanup.task.ts executes the
   *   hard delete once the grace period expires
   */
  async requestDeletion(userId: string): Promise<{ message: string; purgeAt: Date }> {
    const user = await this.findById(userId);

    if (user.scheduledPurgeAt) {
      throw new ConflictException(
        'Your account is already scheduled for deletion. Contact support to cancel.',
      );
    }

    const purgeAt = new Date(
      Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1_000,
    );

    await this.userRepository.update(userId, { scheduledPurgeAt: purgeAt });

    await this.auditLogsService.log({
      action: AuditAction.DELETE,
      entity: AuditEntity.USER,
      entityId: user.id,
      entityTitle: user.name,
      performedBy: user,
      metadata: { scheduledPurgeAt: purgeAt },
    });

    // Notify the user — let them know they have 30 days to contact support
    // if the deletion was accidental.
    void this.emailService.sendAccountDeletionScheduled(
      user.email,
      user.name,
      purgeAt,
    );

    return {
      message: `Your account has been scheduled for permanent deletion on ${purgeAt.toDateString()}. This action can be reversed by contacting support before that date.`,
      purgeAt,
    };
  }

  /**
   * Called by the nightly cleanup task.
   * Hard-deletes all accounts whose grace period has expired.
   * Returns the number of accounts purged.
   */
  async purgeExpiredDeletions(): Promise<number> {
    const expired = await this.userRepository.find({
      where: {
        scheduledPurgeAt: LessThan(new Date()),
      },
    });

    if (expired.length === 0) return 0;

    await this.userRepository.remove(expired);
    return expired.length;
  }
}