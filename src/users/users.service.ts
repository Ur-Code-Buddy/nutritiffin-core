import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './user.role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private dataSource: DataSource,
  ) { }

  async create(
    username: string,
    passwordHash: string,
    role: UserRole,
    name: string,
    email: string,
    phoneNumber: string,
    address: string,
  ): Promise<User> {
    const user = this.usersRepository.create({
      username,
      password_hash: passwordHash,
      role,
      name,
      email,
      phone_number: phoneNumber,
      address,
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

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      select: ['id', 'username', 'name', 'email', 'phone_number', 'role', 'credits', 'is_active', 'created_at']
    });
  }

  async addCredits(id: string, amount: number): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('User not found');

      user.credits = Number(user.credits) + Number(amount);
      return manager.save(user);
    });
  }

  async deductCredits(id: string, amount: number): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('User not found');
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
}

