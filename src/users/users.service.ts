import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, ILike, In, MoreThanOrEqual } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './user.role.enum';
import { Kitchen } from '../kitchens/entities/kitchen.entity';
import { FoodItem } from '../food-items/entities/food-item.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  async create(
    username: string,
    passwordHash: string,
    role: UserRole,
    name: string,
    email: string,
    phone_number: string,
    address: string,
    pincode: string,
  ): Promise<User> {
    const user = this.usersRepository.create({
      username,
      password_hash: passwordHash,
      role,
      name,
      email,
      phone_number,
      address,
      pincode,
    });
    return this.usersRepository.save(user);
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ username });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async findOneByPhoneNumber(phone_number: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ phone_number });
  }

  async findOneById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  async findOneByVerifyToken(token: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ verify_token: token });
  }

  async saveUser(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      select: [
        'id',
        'username',
        'name',
        'email',
        'phone_number',
        'profile_picture_url',
        'role',
        'credits',
        'is_active',
        'is_banned',
        'created_at',
      ],
    });
  }

  async addCredits(username: string, amount: number): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { username },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user)
        throw new NotFoundException(
          `User with username '${username}' not found`,
        );

      user.credits = Number(user.credits) + Number(amount);
      return manager.save(user);
    });
  }

  async deductCredits(username: string, amount: number): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { username },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user)
        throw new NotFoundException(
          `User with username '${username}' not found`,
        );
      if (Number(user.credits) < Number(amount)) {
        throw new BadRequestException('Insufficient credits');
      }

      user.credits = Number(user.credits) - Number(amount);
      return manager.save(user);
    });
  }

  async updateStatus(id: string, is_active: boolean): Promise<User> {
    const user = await this.findOneById(id);
    if (!user) throw new NotFoundException('User not found');
    user.is_active = is_active;
    return this.usersRepository.save(user);
  }

  async incrementTokenVersion(id: string): Promise<User> {
    const user = await this.findOneById(id);
    if (!user) throw new NotFoundException('User not found');
    user.token_version += 1;
    return this.usersRepository.save(user);
  }

  async banUser(id: string): Promise<User> {
    const user = await this.findOneById(id);
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot ban an admin account');
    }
    if (user.is_banned) {
      throw new BadRequestException('User is already banned');
    }
    user.is_banned = true;
    user.token_version += 1; // Invalidate all active sessions immediately
    return this.usersRepository.save(user);
  }

  async unbanUser(id: string): Promise<User> {
    const user = await this.findOneById(id);
    if (!user) throw new NotFoundException('User not found');
    if (!user.is_banned) {
      throw new BadRequestException('User is not banned');
    }
    user.is_banned = false;
    return this.usersRepository.save(user);
  }

  async updateProfile(
    id: string,
    dto: UpdateProfileDto,
  ): Promise<{ user: User; phoneChanged: boolean; changedFields: string[] }> {
    const user = await this.findOneById(id);
    if (!user) throw new NotFoundException('User not found');

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      dto.current_password,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    let phoneChanged = false;
    const changedFields: string[] = [];

    if (dto.address !== undefined && dto.address !== user.address) {
      user.address = dto.address;
      changedFields.push('address');
    }

    if (dto.pincode !== undefined && dto.pincode !== user.pincode) {
      user.pincode = dto.pincode;
      changedFields.push('pincode');
    }

    if (dto.latitude !== undefined) {
      const next =
        dto.latitude === null ? null : String(dto.latitude);
      const prev = user.latitude ?? null;
      if (next !== prev) {
        user.latitude = next;
        changedFields.push('latitude');
      }
    }

    if (dto.longitude !== undefined) {
      const next =
        dto.longitude === null ? null : String(dto.longitude);
      const prev = user.longitude ?? null;
      if (next !== prev) {
        user.longitude = next;
        changedFields.push('longitude');
      }
    }

    if (
      dto.phone_number !== undefined &&
      dto.phone_number !== user.phone_number
    ) {
      // Check if the new phone number is already taken by another user
      const existingUser = await this.findOneByPhoneNumber(dto.phone_number);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException(
          'Phone number already in use by another account',
        );
      }

      user.phone_number = dto.phone_number;
      user.phone_verified = false;
      phoneChanged = true;
      changedFields.push('phone_number');
    }

    if (dto.profile_picture_url !== undefined) {
      const next =
        dto.profile_picture_url === null ? null : dto.profile_picture_url;
      const prev = user.profile_picture_url ?? null;
      if (next !== prev) {
        user.profile_picture_url = next;
        changedFields.push('profile_picture_url');
      }
    }

    if (changedFields.length === 0) {
      return { user, phoneChanged: false, changedFields: [] };
    }

    const savedUser = await this.usersRepository.save(user);
    return { user: savedUser, phoneChanged, changedFields };
  }

  async updateFcmToken(id: string, token: string): Promise<User> {
    const user = await this.findOneById(id);
    if (!user) throw new NotFoundException('User not found');
    user.fcm_token = token;
    return this.usersRepository.save(user);
  }

  async deleteAccount(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id } });
      if (!user) throw new NotFoundException('User not found');

      // Invalidate all active sessions
      user.token_version += 1;
      await manager.save(user);

      // Soft delete the user (sets deleted_at to current timestamp)
      await manager.softRemove(user);

      // If owner is a kitchen owner, soft delete their kitchen and food items
      if (user.role === UserRole.KITCHEN_OWNER) {
        const kitchen = await manager.findOne(Kitchen, {
          where: { owner_id: id },
        });
        if (kitchen) {
          await manager.softRemove(kitchen);
          await manager.softDelete(FoodItem, { kitchen_id: kitchen.id });
        }
      }
    });
  }

  async searchUsers(query: string) {
    return this.usersRepository.find({
      where: [
        { username: ILike(`%${query}%`) },
        { name: ILike(`%${query}%`) },
        { email: ILike(`%${query}%`) },
      ],
      select: ['id', 'username', 'credits', 'is_active', 'is_banned'],
      take: 20,
    });
  }

  async getPlatformStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      total_users,
      active_users,
      disabled_users,
      credits_result,
      active_kitchens,
      pending_deliveries,
      completed_deliveries_today,
      transactions_today,
    ] = await Promise.all([
      this.dataSource.manager.count('User'),
      this.dataSource.manager.count('User', {
        where: { is_active: true, is_banned: false },
      }),
      this.dataSource.manager.count('User', {
        where: [{ is_active: false }, { is_banned: true }],
      }),
      this.dataSource.manager
        .createQueryBuilder('User', 'user')
        .select('SUM(user.credits)', 'total')
        .getRawOne(),
      this.dataSource.manager.count('Kitchen', { where: { is_active: true } }),
      this.dataSource.manager.count('Order', {
        where: {
          status: In([
            'PENDING',
            'ACCEPTED',
            'READY',
            'PICKED_UP',
            'OUT_FOR_DELIVERY',
          ]),
        },
      }),
      this.dataSource.manager.count('Order', {
        where: { status: 'DELIVERED', delivered_at: MoreThanOrEqual(today) },
      }),
      this.dataSource.manager.count('Transaction', {
        where: { created_at: MoreThanOrEqual(today) },
      }),
    ]);

    return {
      total_users,
      active_users,
      disabled_users,
      total_credits_in_circulation: parseFloat(credits_result.total || '0'),
      active_kitchens,
      pending_deliveries,
      completed_deliveries_today,
      transactions_today,
    };
  }
}
