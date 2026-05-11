import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContactRole } from '../enums/contact-role.enum';

/**
 * A Contact is the person responsible for a property — either the OWNER
 * or an AGENT (broker/property manager acting on the owner's behalf).
 */
@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  phone: string;

  /** OWNER = property owner, AGENT = broker/agent managing on behalf of owner */
  @Column({ type: 'enum', enum: ContactRole })
  role: ContactRole;

  @Column({ nullable: true, unique: true })
  email: string;

 @Column({ nullable: true, unique: true })
  whatsapp: string;

  /** Uganda National Identification Number */
  @Column({ nullable: true, unique: true })
  nationalId: string;

  @Column({ nullable: true })
  physicalAddress: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}