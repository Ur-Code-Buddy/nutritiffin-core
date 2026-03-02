import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { BrevoClient } from '@getbrevo/brevo';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/user.role.enum';

async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const backendUrl = process.env.BASE_URL || 'http://localhost:3000';
  const verificationLink = `${backendUrl}/auth/verify-email?token=${token}`;

  const client = new BrevoClient({ apiKey: process.env.BREVO_API_KEY as string });

  try {
    await client.transactionalEmails.sendTransacEmail({
      subject: 'Verify your NutriTiffin account',
      htmlContent: `
        <html>
          <body>
            <h1>Welcome to NutriTiffin!</h1>
            <p>Please click the link below to verify your email address:</p>
            <a href="${verificationLink}">Verify Email</a>
            <p>Or copy and paste this link into your browser:<br/>${verificationLink}</p>
            <p>This link will expire in 24 hours.</p>
          </body>
        </html>
      `,
      sender: { name: 'NutriTiffin', email: 'nutritiffin.kitchen@gmail.com' },
      to: [{ email }],
    });
    console.log(`[EMAIL SENT] Verification email sent to ${email}`);
  } catch (error: any) {
    const errorDetails = error?.body || error?.response?.body || error;
    console.error(`[EMAIL ERROR] Failed to send verification email to ${email}`, JSON.stringify(errorDetails, null, 2));
  }
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) { }

  /**
   * Generate a secure random hex token and its expiry (24h from now).
   */
  private generateVerificationToken(): { token: string; expiresAt: Date } {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return { token, expiresAt };
  }

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
    // Reject unverified users
    if (!user.is_verified) {
      throw new UnauthorizedException(
        'Email not verified. Please check your inbox and verify your email before logging in.',
      );
    }

    // Increment the token version on every login to invalidate old sessions
    const updatedUser = await this.usersService.incrementTokenVersion(user.id);

    const payload = {
      username: user.username,
      sub: user.id,
      role: user.role,
      token_version: updatedUser.token_version,
    };

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

    let user: User;
    try {
      user = await this.usersService.create(
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

    // Generate verification token and persist it
    const { token, expiresAt } = this.generateVerificationToken();
    user.is_verified = false;
    user.verify_token = token;
    user.verify_token_expires_at = expiresAt;
    await this.usersService.saveUser(user);

    await sendVerificationEmail(user.email, token); // TODO: implement with Brevo

    return user;
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    const user = await this.usersService.findOneByVerifyToken(token);
    if (!user) {
      throw new NotFoundException('Invalid verification token');
    }

    if (user.verify_token_expires_at && user.verify_token_expires_at < new Date()) {
      throw new BadRequestException(
        'Verification token has expired. Please request a new one.',
      );
    }

    user.is_verified = true;
    user.verify_token = null;
    user.verify_token_expires_at = null;
    await this.usersService.saveUser(user);

    return { message: 'Email verified successfully. You can now log in.' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new NotFoundException('No account found with this email address');
    }

    if (user.is_verified) {
      throw new BadRequestException('Email is already verified');
    }

    // Regenerate token and expiry
    const { token, expiresAt } = this.generateVerificationToken();
    user.verify_token = token;
    user.verify_token_expires_at = expiresAt;
    await this.usersService.saveUser(user);

    await sendVerificationEmail(user.email, token); // TODO: implement with Brevo

    return { message: 'Verification email has been resent. Please check your inbox.' };
  }
}
