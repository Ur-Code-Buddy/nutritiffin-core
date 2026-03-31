import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { FoodItem } from '../../food-items/entities/food-item.entity';
import { Kitchen } from '../../kitchens/entities/kitchen.entity';
import { Order } from '../../orders/entities/order.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';

@Entity('reviews')
@Unique(['client_id', 'order_item_id']) // One review per food item per order
export class Review {
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

  @Column()
  food_item_id: string;

  @ManyToOne(() => FoodItem)
  @JoinColumn({ name: 'food_item_id' })
  food_item: FoodItem;

  @Column()
  order_id: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column()
  order_item_id: string;

  @ManyToOne(() => OrderItem)
  @JoinColumn({ name: 'order_item_id' })
  order_item: OrderItem;

  /** Integer 1–5 (enforced in service / DTO). */
  @Column({ type: 'smallint' })
  stars: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
