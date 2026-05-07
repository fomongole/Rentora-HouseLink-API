import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { PropertyType } from '../enums/property-type.enum';
import { PropertyStatus } from '../enums/property-status.enum';
import { FurnishingStatus } from '../enums/furnishing-status.enum';
import { LeaseTerm } from '../enums/lease-term.enum';
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

  @Index()
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

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Index()
  @Column({ type: 'enum', enum: PropertyStatus, default: PropertyStatus.AVAILABLE })
  status: PropertyStatus;

  @Column({
    type: 'enum',
    enum: FurnishingStatus,
    default: FurnishingStatus.UNFURNISHED,
    nullable: true,
  })
  furnishing: FurnishingStatus;

  @Column({
    type: 'enum',
    enum: LeaseTerm,
    default: LeaseTerm.MONTHLY,
    nullable: true,
  })
  leaseTerm: LeaseTerm;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  securityDeposit: number;

  @Column({ type: 'date', nullable: true })
  availableFrom: Date;

  @Column({ nullable: true })
  floor: number;

  @Column({ default: false })
  parkingAvailable: boolean;

  @Column({ type: 'simple-array', nullable: true })
  amenities: string[];

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  enquiryCount: number;

  @ManyToOne(() => Landlord, { nullable: false })
  @JoinColumn({ name: 'landlord_id' })
  landlord: Landlord;

  @ManyToOne(() => District, { nullable: false })
  @JoinColumn({ name: 'district_id' })
  district: District;

  /**
   * cascade: true removed intentionally.
   *
   * With cascade: true, TypeORM tries to soft-remove PropertyImage rows when
   * softRemove() is called on the property. But PropertyImage has no
   * @DeleteDateColumn, so TypeORM throws a 500.
   *
   * Images are managed independently via MediaService. Hard-deletes cascade
   * at the DB level via onDelete: 'CASCADE' on the PropertyImage FK.
   */
  @OneToMany(() => PropertyImage, (image) => image.property)
  images: PropertyImage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}