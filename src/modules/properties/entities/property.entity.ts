import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, ManyToMany, JoinTable, JoinColumn,
} from 'typeorm';
import { PropertyType } from '../enums/property-type.enum';
import { PropertyStatus } from '../enums/property-status.enum';
import { Landlord } from '../../landlords/entities/landlord.entity';
import { District } from '../../districts/entities/district.entity';
import { PropertyImage } from './property-image.entity';

@Entity('properties')
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: PropertyType })
  type: PropertyType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ default: 1 })
  bedrooms: number;

  @Column({ default: 1 })
  bathrooms: number;

  @Column()
  area: string;

  @Column({ nullable: true })
  address: string;

  @Column({ type: 'enum', enum: PropertyStatus, default: PropertyStatus.AVAILABLE })
  status: PropertyStatus;

  @Column({ type: 'simple-array', nullable: true })
  amenities: string[];

  @ManyToOne(() => Landlord, { eager: true, nullable: false })
  @JoinColumn({ name: 'landlord_id' })
  landlord: Landlord;

  @ManyToOne(() => District, { eager: true, nullable: false })
  @JoinColumn({ name: 'district_id' })
  district: District;

  @OneToMany(() => PropertyImage, (image) => image.property, { eager: true, cascade: true })
  images: PropertyImage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}