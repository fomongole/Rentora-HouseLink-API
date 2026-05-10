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
import { PropertyType }       from '../enums/property-type.enum';
import { PropertyStatus }     from '../enums/property-status.enum';
import { FurnishingStatus }   from '../enums/furnishing-status.enum';
import { BillingCycle }       from '../enums/billing-cycle.enum';
import { ResidentialSubtype } from '../enums/residential-subtype.enum';
import { HotelCategory }      from '../enums/hotel-category.enum';
import { District }           from '../../districts/entities/district.entity';
import { PropertyImage }      from './property-image.entity';
import { Contact }            from 'src/modules/contacts/entities/contact.entity';

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

  /**
   * Only set when type = RESIDENTIAL_HOUSE.
   * Distinguishes single-room from double-room houses.
   */
  @Column({ type: 'enum', enum: ResidentialSubtype, nullable: true })
  residentialSubtype: ResidentialSubtype | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  /**
   * The pricing period for this property's listed price.
   * - HOSTEL:       null — billing cycle lives on each HostelRoom.
   * - HOTEL_LODGE:  DAILY or MONTHLY.
   * - All others:   MONTHLY | QUARTERLY | BIANNUAL | ANNUAL.
   */
  @Column({ type: 'enum', enum: BillingCycle, nullable: true })
  billingCycle: BillingCycle | null;

  /**
   * Generic room count for the property.
   * Replaces the former separate `bedrooms` + `bathrooms` fields.
   * - Not applicable to HOSTEL (rooms managed via HostelRoom entity → stripped).
   * - Stored in the `number_of_rooms` DB column.
   */
  @Column({ name: 'number_of_rooms', default: 1 })
  numberOfRooms: number;

  /**
   * HOSTEL only: the maximum number of HostelRoom entries that can be created
   * for this property. NULL = no cap enforced (backward-compatible).
   * Enforced in HostelRoomsService.create().
   */
  @Column({ name: 'total_rooms', nullable: true })
  totalRooms: number | null;

  /**
   * HOTEL_LODGE only: tier / service-level category.
   * Stripped for all other property types.
   */
  @Column({ type: 'enum', enum: HotelCategory, name: 'hotel_category', nullable: true })
  hotelCategory: HotelCategory | null;

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

  /**
   * The person responsible for this property — either the OWNER or an AGENT.
   */
  @ManyToOne(() => Contact, { nullable: false })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;

  @ManyToOne(() => District, { nullable: false })
  @JoinColumn({ name: 'district_id' })
  district: District;

  /**
   * Images are managed independently via MediaService.
   * Hard-deletes cascade at DB level via onDelete: 'CASCADE' on the FK.
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