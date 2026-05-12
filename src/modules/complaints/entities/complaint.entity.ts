import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ComplaintStatus } from '../enums/complaint-status.enum';
import { ComplaintCategory } from '../enums/complaint-category.enum';
import { Property } from '../../properties/entities/property.entity';

@Entity('complaints')
export class Complaint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  submitterName: string;

  @Column()
  submitterPhone: string;

  @Column({ type: 'varchar', nullable: true })
  submitterEmail: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Index()
  @Column({ type: 'enum', enum: ComplaintCategory, default: ComplaintCategory.GENERAL })
  category: ComplaintCategory;

  @Column({ type: 'text' })
  description: string;

  @ManyToOne(() => Property, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'property_id' })
  property: Property | null;

  @Index()
  @Column({ type: 'enum', enum: ComplaintStatus, default: ComplaintStatus.OPEN })
  status: ComplaintStatus;

  /** Internal notes — never shown to the renter */
  @Column({ type: 'text', nullable: true })
  adminNotes: string | null;

  /**
   * Admin's reply to the renter — included in the in-app notification
   * and emailed to the renter if they provided submitterEmail.
   */
  @Column({ type: 'text', nullable: true })
  adminReply: string | null;

  @Column({ type: 'varchar', nullable: true })
  resolvedByName: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}