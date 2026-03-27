import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { UserRole } from '../user.role.enum';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  name: string;

  @Column({ unique: true })
  @Exclude()
  email: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  phone_number: string | null;

  @Column()
  address: string;

  @Column()
  pincode: string;

  /** WGS84 — client delivery pin for maps / routing (set via profile update). */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  profile_picture_url: string | null;

  @Column()
  @Exclude()
  password_hash: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CLIENT,
  })
  role: UserRole;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  credits: number;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  email_verified: boolean;

  @Column({ default: false })
  phone_verified: boolean;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  verify_token: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  verify_token_expires_at: Date | null;

  @Column({ type: 'int', default: 0 })
  token_version: number;

  @Column({ default: false })
  is_banned: boolean;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  fcm_token: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;
}
