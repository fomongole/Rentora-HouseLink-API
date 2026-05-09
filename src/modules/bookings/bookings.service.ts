import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Booking } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { FilterBookingsDto } from './dto/filter-bookings.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CancelByRenterDto } from './dto/cancel-by-renter.dto';
import { BookingStatus } from './enums/booking-status.enum';
import { PropertiesService } from '../properties/properties.service';
import { HostelRoomsService } from '../hostel-rooms/hostel-rooms.service';
import { HostelRoomStatus } from '../hostel-rooms/enums/hostel-room-status.enum';
import { PropertyStatus } from '../properties/enums/property-status.enum';
import { PropertyType } from '../properties/enums/property-type.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../audit-logs/enums/audit-action.enum';
import { AuditEntity } from '../audit-logs/enums/audit-entity.enum';
import { User } from '../users/entities/user.entity';
import { HostelRoom } from '../hostel-rooms/entities/hostel-room.entity';
import { BookingCreateResponse } from './interfaces/booking-create-response.interface';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly propertiesService: PropertiesService,
    private readonly hostelRoomsService: HostelRoomsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Called from the mobile app (public endpoint — no auth required).
   *
   * Returns the booking plus a one-time cancellationToken.
   * The mobile app MUST display this token to the renter — it cannot be recovered.
   *
   * Side-effects:
   *   - Hostel room booking → room.status = RESERVED
   */
  async create(dto: CreateBookingDto): Promise<BookingCreateResponse> {
    const property = await this.propertiesService.findOne(dto.propertyId);

    let hostelRoom: HostelRoom | null = null;

    if (dto.hostelRoomId) {
      if (property.type !== PropertyType.HOSTEL) {
        throw new BadRequestException(
          'hostelRoomId can only be provided for properties of type HOSTEL.',
        );
      }

      hostelRoom = await this.hostelRoomsService.findOne(dto.hostelRoomId);

      if (hostelRoom.property.id !== property.id) {
        throw new BadRequestException(
          'The specified room does not belong to the specified hostel property.',
        );
      }

      if (hostelRoom.status !== HostelRoomStatus.AVAILABLE) {
        throw new BadRequestException(
          `Room "${hostelRoom.roomNumber}" is not available (current status: ${hostelRoom.status}).`,
        );
      }
    } else if (property.type === PropertyType.HOSTEL) {
      throw new BadRequestException(
        'Booking a hostel requires a hostelRoomId. Please select a specific room.',
      );
    } else {
      if (property.status !== PropertyStatus.AVAILABLE) {
        throw new BadRequestException(
          `This property is not available for booking (current status: ${property.status}).`,
        );
      }
    }

    // Generate a 6-digit cancellation token — hashed before storage
    const rawToken = crypto.randomInt(100_000, 999_999).toString();
    const tokenHash = await bcrypt.hash(rawToken, 10);

    const booking = this.bookingRepository.create({
      renterName: dto.renterName,
      renterPhone: dto.renterPhone,
      renterEmail: dto.renterEmail ?? null,
      moveInDate: dto.moveInDate as unknown as Date,
      moveOutDate: (dto.moveOutDate ?? null) as unknown as Date | null,
      notes: dto.notes ?? null,
      cancellationTokenHash: tokenHash,
      property,
      hostelRoom,
    });

    const saved = await this.bookingRepository.save(booking);

    if (hostelRoom) {
      await this.hostelRoomsService.setStatus(
        hostelRoom.id,
        HostelRoomStatus.RESERVED,
      );
    }

    // Strip the hash from the response and attach the raw token in its place.
    // This is the only time the raw token is ever returned.
    const { cancellationTokenHash: _hash, ...bookingData } = saved;
    return { ...bookingData, cancellationToken: rawToken };
  }

  async findAll(filters: FilterBookingsDto) {
    const { status, propertyId, page = 1, limit = 20 } = filters;

    const query = this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.property', 'property')
      .leftJoinAndSelect('property.district', 'district')
      .leftJoinAndSelect('booking.hostelRoom', 'hostelRoom')
      .orderBy('booking.createdAt', 'DESC');

    if (status) query.andWhere('booking.status = :status', { status });
    if (propertyId) query.andWhere('property.id = :propertyId', { propertyId });

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

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['property', 'property.district', 'hostelRoom'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  /**
   * Admin confirms a booking.
   * Side-effects:
   *   - Hostel room → OCCUPIED
   *   - Regular property → RENTED
   */
  async confirm(
    id: string,
    dto: ConfirmBookingDto,
    performedBy: User,
  ): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Cannot confirm a booking with status "${booking.status}". Only PENDING bookings can be confirmed.`,
      );
    }

    booking.status = BookingStatus.CONFIRMED;
    booking.confirmedAt = new Date();
    if (dto.adminNotes) booking.adminNotes = dto.adminNotes;

    const saved = await this.bookingRepository.save(booking);

    if (booking.hostelRoom) {
      await this.hostelRoomsService.setStatus(
        booking.hostelRoom.id,
        HostelRoomStatus.OCCUPIED,
      );
    } else {
      await this.propertiesService.setStatus(
        booking.property.id,
        PropertyStatus.RENTED,
      );
    }

    await this.auditLogsService.log({
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.BOOKING,
      entityId: saved.id,
      entityTitle: `Booking by ${saved.renterName} for ${saved.property.title}`,
      performedBy,
      metadata: { from: BookingStatus.PENDING, to: BookingStatus.CONFIRMED },
    });

    return saved;
  }

  /**
   * Cancel a booking (admin or renter).
   * Side-effects:
   *   - Reverts hostel room → AVAILABLE
   *   - Reverts regular property → AVAILABLE (only if previously CONFIRMED)
   */
  async cancel(
    id: string,
    dto: CancelBookingDto,
    cancelledBy: 'admin' | 'renter',
    performedBy?: User,
  ): Promise<Booking> {
    const booking = await this.findOne(id);

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot cancel a booking with status "${booking.status}".`,
      );
    }

    const previousStatus = booking.status;
    booking.status = BookingStatus.CANCELLED;
    booking.cancelledAt = new Date();
    booking.cancelledBy = cancelledBy;
    booking.cancellationReason = dto.reason ?? null;

    const saved = await this.bookingRepository.save(booking);

    if (booking.hostelRoom) {
      await this.hostelRoomsService.setStatus(
        booking.hostelRoom.id,
        HostelRoomStatus.AVAILABLE,
      );
    } else if (previousStatus === BookingStatus.CONFIRMED) {
      await this.propertiesService.setStatus(
        booking.property.id,
        PropertyStatus.AVAILABLE,
      );
    }

    if (performedBy) {
      await this.auditLogsService.log({
        action: AuditAction.STATUS_CHANGE,
        entity: AuditEntity.BOOKING,
        entityId: saved.id,
        entityTitle: `Booking by ${saved.renterName} for ${saved.property.title}`,
        performedBy,
        metadata: {
          from: previousStatus,
          to: BookingStatus.CANCELLED,
          reason: dto.reason,
          cancelledBy,
        },
      });
    }

    return saved;
  }

  /**
   * Renter cancels their own booking by supplying their one-time cancellation token.
   * No admin authentication required — the token IS the proof of ownership.
   */
  async cancelByRenter(id: string, dto: CancelByRenterDto): Promise<Booking> {
    // Must explicitly select the hidden hash column
    const booking = await this.bookingRepository
      .createQueryBuilder('booking')
      .addSelect('booking.cancellationTokenHash')
      .leftJoinAndSelect('booking.property', 'property')
      .leftJoinAndSelect('booking.hostelRoom', 'hostelRoom')
      .where('booking.id = :id', { id })
      .getOne();

    if (!booking) throw new NotFoundException('Booking not found');

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot cancel a booking with status "${booking.status}".`,
      );
    }

    if (!booking.cancellationTokenHash) {
      throw new BadRequestException('This booking cannot be cancelled online.');
    }

    const isValidToken = await bcrypt.compare(
      dto.cancellationToken,
      booking.cancellationTokenHash,
    );

    if (!isValidToken) {
      throw new UnauthorizedException(
        'Invalid cancellation token. Check your booking confirmation.',
      );
    }

    return this.cancel(id, { reason: dto.reason }, 'renter');
  }

  /**
   * Admin marks a booking as completed (renter has moved out).
   * Frees the property or room back to AVAILABLE.
   */
  async complete(id: string, performedBy: User): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Only CONFIRMED bookings can be marked as completed.',
      );
    }

    booking.status = BookingStatus.COMPLETED;
    const saved = await this.bookingRepository.save(booking);

    if (booking.hostelRoom) {
      await this.hostelRoomsService.setStatus(
        booking.hostelRoom.id,
        HostelRoomStatus.AVAILABLE,
      );
    } else {
      await this.propertiesService.setStatus(
        booking.property.id,
        PropertyStatus.AVAILABLE,
      );
    }

    await this.auditLogsService.log({
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.BOOKING,
      entityId: saved.id,
      entityTitle: `Booking by ${saved.renterName} for ${saved.property.title}`,
      performedBy,
      metadata: { from: BookingStatus.CONFIRMED, to: BookingStatus.COMPLETED },
    });

    return saved;
  }

  async getStats() {
    const total = await this.bookingRepository.count();
    const pending = await this.bookingRepository.count({
      where: { status: BookingStatus.PENDING },
    });
    const confirmed = await this.bookingRepository.count({
      where: { status: BookingStatus.CONFIRMED },
    });
    const cancelled = await this.bookingRepository.count({
      where: { status: BookingStatus.CANCELLED },
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thisWeek = await this.bookingRepository
      .createQueryBuilder('booking')
      .where('booking.createdAt >= :sevenDaysAgo', { sevenDaysAgo })
      .getCount();

    return { total, pending, confirmed, cancelled, thisWeek };
  }
}