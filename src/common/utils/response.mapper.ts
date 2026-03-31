import { Order } from '../../orders/entities/order.entity';
import {
  ClientOrderViewDTO,
  OwnerOrderViewDTO,
  DriverDeliveryViewDTO,
  KitchenSummaryDTO,
  UserSummaryDTO,
  OrderItemDTO,
  ClientOrderItemDTO,
} from '../dto/response.dto';

export class ResponseMapper {
  private static assignOrderCore(
    dto:
      | ClientOrderViewDTO
      | OwnerOrderViewDTO
      | DriverDeliveryViewDTO,
    order: Order,
  ) {
    dto.id = order.id;
    dto.status = order.status;
    dto.scheduled_for = order.scheduled_for;
    dto.notes = order.notes ?? null;
    dto.created_at = order.created_at;
    dto.total_price = Number(order.total_price);
    dto.platform_fees = Number(order.platform_fees);
    dto.delivery_fees = Number(order.delivery_fees);
    dto.tax_fees = Number(order.tax_fees || 0);

    if (order.kitchen) {
      const kitchenDto = new KitchenSummaryDTO();
      kitchenDto.id = order.kitchen.id;
      kitchenDto.name = order.kitchen.name;
      kitchenDto.is_veg = Boolean(order.kitchen.is_veg);
      if (order.kitchen.details) {
        kitchenDto.phone = order.kitchen.details.phone;
        kitchenDto.address = order.kitchen.details.address;
      }
      dto.kitchen = kitchenDto;
    }

    if (order.delivery_driver) {
      const driverDto = new UserSummaryDTO();
      driverDto.id = order.delivery_driver.id;
      driverDto.name = order.delivery_driver.name;
      driverDto.phone_number = order.delivery_driver.phone_number;
      driverDto.address = order.delivery_driver.address;
      driverDto.profile_picture_url =
        order.delivery_driver.profile_picture_url ?? null;
      dto.delivery_driver = driverDto;
    }
  }

  private static mapOwnerOrderItems(order: Order): OrderItemDTO[] {
    if (!order.items) {
      return [];
    }
    return order.items.map((item) => {
      const itemDto = new OrderItemDTO();
      if (item.food_item) {
        itemDto.food_item_id = item.food_item.id;
        itemDto.name = item.food_item.name;
        itemDto.image_url = item.food_item.image_url;
        itemDto.quantity = item.quantity;
        itemDto.snapshot_price = Number(item.snapshot_price);
      }
      return itemDto;
    });
  }

  private static mapClientOrderItems(
    order: Order,
    itemStars?: Map<string, number>,
  ): ClientOrderItemDTO[] {
    if (!order.items) {
      return [];
    }
    return order.items.map((item) => {
      const itemDto = new ClientOrderItemDTO();
      itemDto.order_item_id = item.id;
      if (item.food_item) {
        itemDto.food_item_id = item.food_item.id;
        itemDto.name = item.food_item.name;
        itemDto.image_url = item.food_item.image_url;
        itemDto.quantity = item.quantity;
        itemDto.snapshot_price = Number(item.snapshot_price);
      }
      const stars = itemStars?.get(item.id);
      itemDto.is_rated = stars !== undefined;
      itemDto.rating = stars !== undefined ? { stars } : null;
      return itemDto;
    });
  }

  static toClientOrderView(
    order: Order,
    itemStars?: Map<string, number>,
  ): ClientOrderViewDTO {
    const dto = new ClientOrderViewDTO();
    this.assignOrderCore(dto, order);
    dto.items = this.mapClientOrderItems(order, itemStars);
    return dto;
  }

  static toOwnerOrderView(order: Order): OwnerOrderViewDTO {
    const dto = new OwnerOrderViewDTO();
    this.assignOrderCore(dto, order);
    dto.items = this.mapOwnerOrderItems(order);

    if (order.client) {
      const clientDto = new UserSummaryDTO();
      clientDto.id = order.client.id;
      clientDto.name = order.client.name;
      clientDto.phone_number = order.client.phone_number;
      clientDto.address = order.client.address;
      clientDto.profile_picture_url = order.client.profile_picture_url ?? null;
      dto.client = clientDto;
    }

    dto.kitchen_fees = Number(order.kitchen_fees);

    return dto;
  }

  static toDriverDeliveryView(order: Order): DriverDeliveryViewDTO {
    const dto = new DriverDeliveryViewDTO();
    this.assignOrderCore(dto, order);
    dto.items = this.mapOwnerOrderItems(order);

    if (order.client) {
      const clientDto = new UserSummaryDTO();
      clientDto.id = order.client.id;
      clientDto.name = order.client.name;
      clientDto.phone_number = order.client.phone_number;
      clientDto.address = order.client.address;
      clientDto.profile_picture_url = order.client.profile_picture_url ?? null;
      dto.client = clientDto;
    }

    return dto;
  }
}
