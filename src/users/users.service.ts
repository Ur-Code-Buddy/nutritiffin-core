import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './user.role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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
}
