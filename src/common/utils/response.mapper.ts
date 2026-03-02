import { Order } from '../../orders/entities/order.entity';
import {
  ClientOrderViewDTO,
  OwnerOrderViewDTO,
  DriverDeliveryViewDTO,
  KitchenSummaryDTO,
  UserSummaryDTO,
  OrderItemDTO,
} from '../dto/response.dto';

export class ResponseMapper {
  static toClientOrderView(order: Order): ClientOrderViewDTO {
    const dto = new ClientOrderViewDTO();
    dto.id = order.id;
    dto.status = order.status;
    dto.scheduled_for = order.scheduled_for;
    dto.total_price = Number(order.total_price);
    dto.platform_fees = Number(order.platform_fees);
    dto.delivery_fees = Number(order.delivery_fees);

    if (order.items) {
      dto.items = order.items.map((item) => {
        const itemDto = new OrderItemDTO();
        // Check if food_item is loaded
        if (item.food_item) {
          itemDto.food_item_id = item.food_item.id;
          itemDto.name = item.food_item.name;
          itemDto.image_url = item.food_item.image_url;
          itemDto.quantity = item.quantity;
          itemDto.snapshot_price = Number(item.snapshot_price);
        }
        return itemDto;
      });
    } else {
      dto.items = [];
    }

    if (order.kitchen) {
      const kitchenDto = new KitchenSummaryDTO();
      kitchenDto.id = order.kitchen.id;
      kitchenDto.name = order.kitchen.name;
      // Handle potential nulls in details
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
      dto.delivery_driver = driverDto;
    }

    return dto;
  }

  static toOwnerOrderView(order: Order): OwnerOrderViewDTO {
    const dto = new OwnerOrderViewDTO();
    // Copy base properties
    const base = this.toClientOrderView(order);
    Object.assign(dto, base);

    if (order.client) {
      const clientDto = new UserSummaryDTO();
      clientDto.id = order.client.id;
      clientDto.name = order.client.name;
      clientDto.phone_number = order.client.phone_number;
      clientDto.address = order.client.address;
      dto.client = clientDto;
    }

    dto.kitchen_fees = Number(order.kitchen_fees);

    return dto;
  }

  static toDriverDeliveryView(order: Order): DriverDeliveryViewDTO {
    const dto = new DriverDeliveryViewDTO();
    // Copy base properties
    const base = this.toClientOrderView(order);
    Object.assign(dto, base);

    if (order.client) {
      const clientDto = new UserSummaryDTO();
      clientDto.id = order.client.id;
      clientDto.name = order.client.name;
      clientDto.phone_number = order.client.phone_number;
      clientDto.address = order.client.address;
      dto.client = clientDto;
    }

    return dto;
  }
}
