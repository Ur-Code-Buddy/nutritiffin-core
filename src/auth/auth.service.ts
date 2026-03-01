import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/user.role.enum';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) { }

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByUsername(username);
    if (user && (await bcrypt.compare(pass, user.password_hash))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<User> {
    if (registerDto.role === UserRole.ADMIN) {
      const adminPass = process.env.ADMIN_ACCESS_PASS;
      if (!registerDto.admin_access_pass || registerDto.admin_access_pass !== adminPass) {
        throw new UnauthorizedException('Invalid or missing admin access pass');
      }
    }

    const existingUser = await this.usersService.findOneByUsername(
      registerDto.username,
    );
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    const existingEmail = await this.usersService.findOneByEmail(
      registerDto.email,
    );
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const existingPhone = await this.usersService.findOneByPhoneNumber(
      registerDto.phone_number,
    );
    if (existingPhone) {
      throw new ConflictException('Phone number already exists');
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(registerDto.password, salt);

    try {
      return await this.usersService.create(
        registerDto.username,
        passwordHash,
        registerDto.role,
        registerDto.name,
        registerDto.email,
        registerDto.phone_number,
        registerDto.address,
      );
    } catch (error) {
      if (error.code === '23505') {
        // Postgres unique_violation safely checked
        const detail = error.detail || '';
        if (detail.includes('email')) {
          throw new ConflictException('Email already exists');
        } else if (detail.includes('phone_number')) {
          throw new ConflictException('Phone number already exists');
        } else if (detail.includes('username')) {
          throw new ConflictException('Username already exists');
        }
      }
      throw error;
    }
  }
}
