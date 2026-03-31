import { Exclude, Expose, Type } from 'class-transformer';

export class UserSummaryDTO {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  phone_number: string | null;

  @Expose()
  address: string;

  @Expose()
  profile_picture_url: string | null;
}

export class KitchenSummaryDTO {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  phone: string;

  @Expose()
  address: string;

  @Expose()
  is_veg: boolean;
}

export class OrderItemDTO {
  @Expose()
  food_item_id: string;

  @Expose()
  name: string;

  @Expose()
  image_url: string;

  @Expose()
  quantity: number;

  @Expose()
  snapshot_price: number;
}

/** Client order line: includes line id and optional star rating for that line. */
export class ClientOrderItemDTO {
  @Expose()
  order_item_id: string;

  @Expose()
  food_item_id: string;

  @Expose()
  name: string;

  @Expose()
  image_url: string;

  @Expose()
  quantity: number;

  @Expose()
  snapshot_price: number;

  @Expose()
  is_rated: boolean;

  @Expose()
  rating: { stars: number } | null;
}

export class BaseOrderViewDTO {
  @Expose()
  id: string;

  @Expose()
  status: string;

  @Expose()
  scheduled_for: string;

  /** Instructions for the kitchen from the client; null if none. */
  @Expose()
  notes: string | null;

  @Expose()
  created_at: Date;

  @Expose()
  total_price: number;

  @Expose()
  platform_fees: number;

  @Expose()
  delivery_fees: number;

  @Expose()
  tax_fees: number;

  @Expose()
  @Type(() => OrderItemDTO)
  items: OrderItemDTO[];

  @Expose()
  @Type(() => KitchenSummaryDTO)
  kitchen: KitchenSummaryDTO;

  @Expose()
  @Type(() => UserSummaryDTO)
  delivery_driver: UserSummaryDTO;
}

export class ClientOrderViewDTO extends BaseOrderViewDTO {
  @Expose()
  @Type(() => ClientOrderItemDTO)
  declare items: ClientOrderItemDTO[];
}

export class OwnerOrderViewDTO extends BaseOrderViewDTO {
  @Expose()
  @Type(() => UserSummaryDTO)
  client: UserSummaryDTO;

  @Expose()
  kitchen_fees: number;
}

export class DriverDeliveryViewDTO extends BaseOrderViewDTO {
  @Expose()
  @Type(() => UserSummaryDTO)
  client: UserSummaryDTO;

  // Driver might need less info about price, but total_price is often relevant for COD.
  // We can keep it or Exclude it if strict requirements say 'unrelated fields'.
  // User asked for "No password_hash or unrelated fields".
  // Keeping price for now as it's standard order info.
}
