import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../enums/user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.RENTER })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  /**
   * When set, the account is pending deletion and will be hard-deleted
   * by the nightly cleanup task once this timestamp passes.
   * The user is immediately locked out when this is set.
   */
  @Column({ type: 'timestamptz', nullable: true, default: null, name: 'scheduled_purge_at' })
  scheduledPurgeAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}