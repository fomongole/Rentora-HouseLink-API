import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Stores invalidated JWT IDs (jti claims) so that logged-out tokens
 * cannot be reused even before they expire.
 *
 * A scheduled cleanup job (or TypeORM hook) should periodically purge
 * rows where expiresAt < NOW() to keep the table small.
 */
@Entity('token_blacklist')
export class BlacklistedToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The unique JWT ID (jti claim) embedded in the token at sign time. */
  @Index({ unique: true })
  @Column()
  jti: string;

  /** Mirrors the JWT exp — lets us skip DB cleanup for already-expired entries. */
  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}