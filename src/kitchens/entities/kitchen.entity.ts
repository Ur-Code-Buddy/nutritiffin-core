import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { FoodItem } from '../../food-items/entities/food-item.entity';
import { Transform } from 'class-transformer';

@Entity('kitchens')
export class Kitchen {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  owner_id: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column()
  name: string;

  @Column('jsonb', { nullable: true })
  @Transform(({ value }: { value: any }) => {
    if (value && typeof value === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { email, ...rest } = value;
      return rest;
    }
    return value;
  })
  details: {
    address: string;
    phone: string;
    email: string;
    description?: string;
  };

  @Column('jsonb', { nullable: true })
  operating_hours: any;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: true })
  is_menu_visible: boolean;

  /**
   * When true, new orders for this kitchen are created as ACCEPTED (no manual accept/reject).
   * Kitchen owners toggle via PATCH /kitchens/me/auto-accept-orders.
   */
  @Column({ default: false })
  auto_accept_orders: boolean;

  @Column({ nullable: true })
  image_url: string;

  /** WGS84 — pickup location for driver routing (set via kitchen create/update). */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @OneToMany(() => FoodItem, (item) => item.kitchen)
  food_items: FoodItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;
}
