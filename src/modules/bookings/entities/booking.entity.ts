import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BookingStatus } from '../enums/booking-status.enum';
import { Property } from '../../properties/entities/property.entity';
import { HostelRoom } from '../../hostel-rooms/entities/hostel-room.entity';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Who is booking ────────────────────────────────────────────────────────

  @Column()
  renterName: string;

  @Column()
  renterPhone: string;

  @Column({ type: 'varchar', nullable: true })
  renterEmail: string | null;

  // ── What they are booking ─────────────────────────────────────────────────

  /**
   * The property being booked.
   * - For regular properties: this is the unit itself.
   * - For hostel bookings: this is the parent hostel.
   *   In this case hostelRoom is also set.
   */
  @ManyToOne(() => Property, { nullable: false, eager: true })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  /**
   * Only set for hostel room bookings.
   * When set, the booking is for a specific room within the hostel property.
   */
  @ManyToOne(() => HostelRoom, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hostel_room_id' })
  hostelRoom: HostelRoom | null;

  // ── Booking dates ─────────────────────────────────────────────────────────

  @Column({ type: 'date' })
  moveInDate: Date;

  /** Optional — some agreements are open-ended */
  @Column({ type: 'date', nullable: true })
  moveOutDate: Date | null;

  // ── Status & meta ─────────────────────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  /** Renter's message/questions when submitting the booking request */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Admin-only internal notes — never exposed to the mobile app */
  @Column({ type: 'text', nullable: true })
  adminNotes: string | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  /** 'admin' | 'renter' — who initiated the cancellation */
  @Column({ type: 'varchar', nullable: true })
  cancelledBy: 'admin' | 'renter' | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}