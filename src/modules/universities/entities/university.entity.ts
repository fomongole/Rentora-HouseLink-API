import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('universities')
export class University {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  /**
   * Common abbreviation shown in UI dropdowns and property cards.
   * e.g. 'MUK', 'KYU', 'UCU'.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  shortName: string | null;

  /**
   * Human-readable area / neighbourhood.
   * e.g. 'Wandegeya, Kampala'.
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}