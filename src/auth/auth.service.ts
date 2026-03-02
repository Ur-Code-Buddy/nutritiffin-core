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
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f4f7f6;
                margin: 0;
                padding: 0;
                color: #333333;
              }
              .container {
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
              }
              .header {
                background-color: #4CAF50;
                padding: 30px 20px;
                text-align: center;
              }
              .header h1 {
                color: #ffffff;
                margin: 0;
                font-size: 28px;
                font-weight: 600;
              }
              .content {
                padding: 40px 30px;
                text-align: center;
              }
              .content p {
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 25px;
                color: #555555;
              }
              .button {
                display: inline-block;
                padding: 14px 32px;
                background-color: #4CAF50;
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 4px;
                font-size: 16px;
                font-weight: bold;
                letter-spacing: 0.5px;
                transition: background-color 0.3s;
              }
              .button:hover {
                background-color: #45a049;
              }
              .divider {
                height: 1px;
                background-color: #e0e0e0;
                margin: 30px 0;
              }
              .fallback-link {
                font-size: 14px;
                color: #777777;
                word-break: break-all;
                background-color: #f9f9f9;
                padding: 12px;
                border-radius: 4px;
              }
              .footer {
                background-color: #f9f9f9;
                padding: 20px;
                text-align: center;
                font-size: 13px;
                color: #888888;
                border-top: 1px solid #eeeeee;
              }
            </style>
          </head>
            <body>
            <div class="container">
              <div class="header">
                <h1>NutriTiffin</h1>
              </div>
              <div class="content">
                <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
                <p>Welcome to NutriTiffin! We're thrilled to have you on board. Please verify your email address to activate your account and access all our delicious features.</p>

                <div style="background-color: #fff8e1; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px; font-size: 14px; color: #555;">
                  ⚠️ <strong>Security Notice:</strong> This email was sent by <strong>NutriTiffin</strong> from <strong>no-reply@nutritiffin.com</strong>. If you did <em>not</em> create a NutriTiffin account, please ignore this email or <a href="mailto:support@nutritiffin.com" style="color: #f59e0b;">contact our support team</a>.
                </div>

                <a href="${verificationLink}" class="button">Verify Account</a>
                
                <div class="divider"></div>
                
                <p style="font-size: 14px; margin-bottom: 10px;">Button not working? Copy and paste this link into your browser:</p>
                <div class="fallback-link">
                  ${verificationLink}
                </div>
              </div>
              <div class="footer">
                <p>This verification link will expire in 24 hours.</p>
                <p>If you did not request this email, no action is required — simply ignore it.</p>
                <p>&copy; ${new Date().getFullYear()} NutriTiffin. All rights reserved.</p>
              </div>
            </div>
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
