import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Kitchen } from '../../kitchens/entities/kitchen.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  PICKED_UP = 'PICKED_UP',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  REJECTED = 'REJECTED',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  client_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'client_id' })
  client: User;

  @Column()
  kitchen_id: string;

  @ManyToOne(() => Kitchen)
  @JoinColumn({ name: 'kitchen_id' })
  kitchen: Kitchen;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'date' })
  scheduled_for: string; // YYYY-MM-DD

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true })
  delivery_driver_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'delivery_driver_id' })
  delivery_driver: User;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  platform_fees: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  delivery_fees: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  kitchen_fees: number;

  @Column({ nullable: true })
  accepted_at: Date;

  @Column({ nullable: true })
  picked_up_at: Date;

  @Column({ nullable: true })
  delivered_at: Date;
}
