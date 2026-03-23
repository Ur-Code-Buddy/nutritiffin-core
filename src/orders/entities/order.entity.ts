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
  READY = 'READY',
  PICKED_UP = 'PICKED_UP',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  REJECTED = 'REJECTED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

export enum RefundStatus {
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
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

  // Razorpay payment metadata (only set when order is created via `/payments/*`)
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  // Explicit DB type required: `string | null` reflects as Object and breaks Postgres metadata
  @Column({ type: 'varchar', length: 255, nullable: true })
  razorpayOrderId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  razorpayPaymentId: string | null;

  @Column({
    type: 'enum',
    enum: RefundStatus,
    default: RefundStatus.NOT_APPLICABLE,
  })
  refund_status: RefundStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  razorpay_refund_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  refund_initiated_at: Date | null;

  @Column({ type: 'date', nullable: true })
  refund_expected_by: string | null;

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

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tax_fees: number;

  @Column({ nullable: true })
  accepted_at: Date;

  @Column({ nullable: true })
  ready_at: Date;

  @Column({ nullable: true })
  picked_up_at: Date;

  @Column({ nullable: true })
  delivered_at: Date;
}
