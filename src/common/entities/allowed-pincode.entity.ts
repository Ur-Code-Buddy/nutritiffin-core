import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('allowed_pincodes')
export class AllowedPincode {
  @PrimaryColumn()
  pincode: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
