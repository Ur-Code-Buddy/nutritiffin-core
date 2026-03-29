import 'reflect-metadata';
import { instanceToPlain } from 'class-transformer';
import { User } from '../../users/entities/user.entity';
import { Kitchen } from '../../kitchens/entities/kitchen.entity';
import { Order, OrderStatus } from '../../orders/entities/order.entity';
import { ResponseMapper } from './response.mapper';
import { UserRole } from '../../users/user.role.enum';

describe('Serialization Unit Test', () => {
  it('should exclude password_hash and email from User entity via class-transformer', () => {
    const user = new User();
    user.id = '123';
    user.email = 'test@example.com';
    user.password_hash = 'secret';
    user.username = 'testuser';
    user.role = UserRole.CLIENT;

    const plain = instanceToPlain(user);
    expect(plain.password_hash).toBeUndefined();
    expect(plain.email).toBeUndefined();
    expect(plain.username).toBe('testuser');
  });

  it('should exclude email from Kitchen details via custom transform', () => {
    const kitchen = new Kitchen();
    kitchen.details = {
      address: '123 St',
      phone: '555-5555',
      email: 'kitchen@example.com',
    };

    const plain = instanceToPlain(kitchen);
    expect(plain.details.email).toBeUndefined();
    expect(plain.details.address).toBe('123 St');
  });

  it('should Map Order to ClientOrderViewDTO correctly', () => {
    const order = new Order();
    order.id = 'order-1';
    order.status = OrderStatus.PENDING;
    order.total_price = 100.5;

    const user = new User();
    user.id = 'user-1';
    user.name = 'Client Name';
    user.phone_number = '1234567890';
    user.email = 'client@example.com';

    order.client = user;
    order.client_id = user.id;

    const kitchen = new Kitchen();
    kitchen.id = 'kitchen-1';
    kitchen.name = 'Test Kitchen';
    kitchen.is_veg = true;
    kitchen.details = { address: 'K St', phone: '999', email: 'k@example.com' };
    order.kitchen = kitchen;
    order.notes = 'Less oil, no onion';

    const dto = ResponseMapper.toClientOrderView(order);
    const plainDto = instanceToPlain(dto);

    expect(plainDto.id).toBe('order-1');
    expect(plainDto.total_price).toBe(100.5);
    expect(plainDto.kitchen.name).toBe('Test Kitchen');
    expect(plainDto.kitchen.is_veg).toBe(true);
    expect(plainDto.notes).toBe('Less oil, no onion');
    expect(plainDto.kitchen.email).toBeUndefined(); // Via DTO definition which doesn't have email

    // Client view should not have client details in root
    expect((dto as any).client).toBeUndefined();
  });

  it('should Map Order to OwnerOrderViewDTO correctly', () => {
    const order = new Order();
    order.id = 'order-1';
    order.status = OrderStatus.PENDING;

    const user = new User();
    user.id = 'user-1';
    user.name = 'Client Name';
    user.phone_number = '1234567890';

    order.client = user;

    const dto = ResponseMapper.toOwnerOrderView(order);

    expect(dto.client).toBeDefined();
    expect(dto.client.name).toBe('Client Name');
    expect(dto.client.phone_number).toBe('1234567890');
  });
});
