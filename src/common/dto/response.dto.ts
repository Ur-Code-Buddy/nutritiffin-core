import { Exclude, Expose, Type } from 'class-transformer';

export class UserSummaryDTO {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  phone_number: string;

  @Expose()
  address: string;
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

export class BaseOrderViewDTO {
  @Expose()
  id: string;

  @Expose()
  status: string;

  @Expose()
  scheduled_for: string;

  @Expose()
  total_price: number;

  @Expose()
  platform_fees: number;

  @Expose()
  delivery_fees: number;

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
  // Client specific fields if any (currently matches Base)
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
