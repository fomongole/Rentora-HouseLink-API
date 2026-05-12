import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { NotificationType } from './enums/notification-type.enum';
import { CreateNotificationParams } from './interfaces/create-notification.interface';
import { FilterNotificationsDto } from './dto/filter-notifications.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    /**
     * Direct user repository access — used only for the broadcast flow
     * to fetch all active RENTER user IDs. We do NOT inject UsersService
     * to avoid a circular dependency (UsersModule → NotificationsModule).
     */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Create a single notification for one user.
   * Fire-and-forget — a failure never propagates to the caller.
   */
  async create(params: CreateNotificationParams): Promise<void> {
    try {
      const notification = this.notificationRepository.create({
        user: { id: params.userId }, // Safely passes the user relation to satisfy the foreign key
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data ?? null,
        isRead: false,
      });

      await this.notificationRepository.save(notification);
    } catch (err) {
      console.error('[Notifications] Failed to create notification:', err);
    }
  }

  /**
   * Broadcast a notification to every active RENTER user.
   *
   * One notification row is created per renter so that read/unread state
   * is tracked independently for each user. This is fine at typical
   * platform scale; revisit with a fan-out queue for 10k+ users.
   *
   * Fires-and-forgets — failures are logged but never surface to the caller.
   */
  async broadcast(
    params: Omit<CreateNotificationParams, 'userId'>,
  ): Promise<void> {
    try {
      const renters = await this.userRepository.find({
        where: { role: UserRole.RENTER, isActive: true },
        select: ['id'],
      });

      if (renters.length === 0) return;

      const notifications = renters.map((renter) =>
        this.notificationRepository.create({
          user: { id: renter.id }, // Safely passes the user relation to satisfy the foreign key
          type: params.type,
          title: params.title,
          message: params.message,
          data: params.data ?? null,
          isRead: false,
        }),
      );

      // Save in one round-trip
      await this.notificationRepository.save(notifications);
    } catch (err) {
      console.error('[Notifications] Failed to broadcast notification:', err);
    }
  }

  // ── User-facing queries ───────────────────────────────────────────────────

  async findForUser(userId: string, filters: FilterNotificationsDto) {
    const { type, isRead, page = 1, limit = 20 } = filters;
    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC');

    if (type !== undefined) {
      query.andWhere('notification.type = :type', { type });
    }
    if (isRead !== undefined) {
      query.andWhere('notification.isRead = :isRead', { isRead });
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

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async findOneForUser(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.findOneForUser(id, userId);
    if (notification.isRead) return notification; // already read — no-op

    notification.isRead = true;
    notification.readAt = new Date();
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: new Date() })
      .where('userId = :userId AND isRead = false', { userId })
      .execute();

    return { updated: result.affected ?? 0 };
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    const notification = await this.findOneForUser(id, userId);
    await this.notificationRepository.remove(notification);
    return { message: 'Notification deleted' };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  /**
   * Admin-initiated broadcast to all active renters.
   * Uses NotificationType.SYSTEM_ALERT so the mobile app can style it distinctly.
   */
  async adminBroadcast(dto: BroadcastNotificationDto): Promise<{ message: string }> {
    await this.broadcast({
      type: NotificationType.SYSTEM_ALERT,
      title: dto.title,
      message: dto.message,
      data: dto.data,
    });

    return { message: 'Notification broadcast to all active renters' };
  }

  // ── Convenience factories called by other services ────────────────────────
  // These centralise the copy so business services stay lean.

  sendWelcome(userId: string, name: string): Promise<void> {
    return this.create({
      userId,
      type: NotificationType.WELCOME,
      title: 'Welcome to Rentora Houselink Uganda! 🏠',
      message: `Hi ${name}! Your account is ready. Start exploring properties near you.`,
      data: {},
    });
  }

  sendBookingConfirmed(
    userId: string,
    payload: { bookingId: string; propertyId: string; propertyTitle: string; moveInDate: string },
  ): Promise<void> {
    return this.create({
      userId,
      type: NotificationType.BOOKING_CONFIRMED,
      title: 'Booking Confirmed ✅',
      message: `Your booking for "${payload.propertyTitle}" has been confirmed. Move-in date: ${payload.moveInDate}.`,
      data: payload,
    });
  }

  sendBookingCancelledByAdmin(
    userId: string,
    payload: { bookingId: string; propertyId: string; propertyTitle: string; reason?: string },
  ): Promise<void> {
    const reasonSuffix = payload.reason ? ` Reason: ${payload.reason}` : '';
    return this.create({
      userId,
      type: NotificationType.BOOKING_CANCELLED,
      title: 'Booking Cancelled',
      message: `Your booking for "${payload.propertyTitle}" has been cancelled by an admin.${reasonSuffix}`,
      data: payload,
    });
  }

  sendBookingCompleted(
    userId: string,
    payload: { bookingId: string; propertyId: string; propertyTitle: string },
  ): Promise<void> {
    return this.create({
      userId,
      type: NotificationType.BOOKING_COMPLETED,
      title: 'Booking Completed',
      message: `Your stay at "${payload.propertyTitle}" has been marked as completed. Thank you for choosing Rentora Houselink Uganda!`,
      data: payload,
    });
  }

  sendComplaintUpdated(
    userId: string,
    payload: { complaintId: string; newStatus: string; category: string; adminReply?: string },
  ): Promise<void> {
    const statusLabel = payload.newStatus.replace(/_/g, ' ');
    const categoryLabel = payload.category.replace(/_/g, ' ');

    const message = payload.adminReply
      ? `Your complaint (${categoryLabel}) is now ${statusLabel}. Admin reply: "${payload.adminReply}"`
      : `Your complaint (${categoryLabel}) status has been updated to ${statusLabel}.`;

    return this.create({
      userId,
      type: NotificationType.COMPLAINT_UPDATED,
      title: 'Complaint Update',
      message,
      data: payload,
    });
  }

  sendNewPropertyBroadcast(payload: {
    propertyId: string;
    propertyTitle: string;
    type: string;
    price: number;
    area: string;
  }): Promise<void> {
    return this.broadcast({
      type: NotificationType.NEW_PROPERTY,
      title: 'New Property Listed 🏡',
      message: `A new ${payload.type.replace(/_/g, ' ')} is now available in ${payload.area} — check it out!`,
      data: payload,
    });
  }

  sendAccountActivated(userId: string): Promise<void> {
    return this.create({
      userId,
      type: NotificationType.ACCOUNT_ACTIVATED,
      title: 'Account Activated',
      message: 'Your Rentora Houselink Uganda account has been activated. You can now browse and book properties.',
    });
  }

  sendAccountDeactivated(userId: string): Promise<void> {
    return this.create({
      userId,
      type: NotificationType.ACCOUNT_DEACTIVATED,
      title: 'Account Deactivated',
      message: 'Your Rentora Houselink Uganda account has been deactivated. Please contact support if you believe this is an error.',
    });
  }

  sendPasswordChanged(userId: string): Promise<void> {
    return this.create({
      userId,
      type: NotificationType.PASSWORD_CHANGED,
      title: 'Password Changed 🔐',
      message: 'Your password was changed successfully. If you did not make this change, contact support immediately.',
    });
  }
}