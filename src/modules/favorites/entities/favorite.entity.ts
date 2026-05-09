import { Property } from 'src/modules/properties/entities/property.entity';
import { User } from 'src/modules/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
  Column,
} from 'typeorm';

@Entity('favorites')
@Unique(['userId', 'propertyId']) // Prevents a user from favoriting the same property twice
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Index()
  @Column({ type: 'uuid', name: 'property_id' })
  propertyId: string;

  @CreateDateColumn()
  createdAt: Date;
}