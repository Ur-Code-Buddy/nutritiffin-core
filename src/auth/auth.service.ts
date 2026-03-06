import {
  Injectable,
  Inject,
  forwardRef,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { BrevoClient } from '@getbrevo/brevo';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendPhoneOtpDto } from './dto/resend-phone-otp.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/user.role.enum';
import { RedisService } from '../redis/redis.service';

async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const backendUrl = process.env.BASE_URL || 'http://localhost:3000';
  const verificationLink = `${backendUrl}/auth/verify-email?token=${token}`;

  if (process.env.PRODUCTION === 'false') {
    console.log(`[DEV MODE] Email verification link for ${email}: ${verificationLink}`);
    return;
  }

  const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY as string,
  });

  try {
    await client.transactionalEmails.sendTransacEmail({
      subject: 'Verify your NutriTiffin account',
      htmlContent: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email | NutriTiffin</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                background-color: #f4f6f8;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                color: #333333;
              }
              .container {
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 8px;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
                overflow: hidden;
              }
              .header {
                background-color: #1f2937;
                padding: 28px 20px;
                text-align: center;
              }
              .header h1 {
                color: #ffffff;
                margin: 0;
                font-size: 24px;
                font-weight: 600;
                letter-spacing: 0.5px;
              }
              .content {
                padding: 40px 35px;
                text-align: left;
              }
              .content h2 {
                margin-top: 0;
                font-size: 20px;
                font-weight: 600;
                color: #111827;
              }
              .content p {
                font-size: 15px;
                line-height: 1.7;
                color: #4b5563;
                margin-bottom: 20px;
              }
              .button-wrapper {
                text-align: center;
                margin: 30px 0;
              }
              .button {
                display: inline-block;
                padding: 14px 34px;
                background-color: #2563eb;
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 6px;
                font-size: 15px;
                font-weight: 600;
                letter-spacing: 0.4px;
              }
              .button:hover {
                background-color: #1e40af;
              }
              .divider {
                height: 1px;
                background-color: #e5e7eb;
                margin: 30px 0;
              }
              .fallback-text {
                font-size: 13px;
                color: #6b7280;
                margin-bottom: 8px;
              }
              .fallback-link {
                font-size: 13px;
                color: #1d4ed8;
                word-break: break-all;
              }
              .security-note {
                font-size: 12px;
                color: #6b7280;
                margin-top: 25px;
              }
              .footer {
                background-color: #f9fafb;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #9ca3af;
                border-top: 1px solid #e5e7eb;
              }
            </style>
          </head>
          <body>
            <div class="container">
              
              <div class="header">
                <h1>NutriTiffin</h1>
              </div>

              <div class="content">
                <h2>Verify Your Email Address</h2>

                <p>
                  Thank you for signing up with NutriTiffin. To activate your account and begin using our services, please confirm your email address by clicking the button below.
                </p>

                <div class="button-wrapper">
                  <a href="${verificationLink}" class="button">Verify Email Address</a>
                </div>

                <div class="divider"></div>

                <p class="fallback-text">
                  If the button above does not work, copy and paste the following link into your browser:
                </p>
                <p class="fallback-link">
                  ${verificationLink}
                </p>

                <p class="security-note">
                  This email was sent from no-reply@nutritiffin.com. If you did not create an account with NutriTiffin, you may safely ignore this message or contact support@nutritiffin.com for assistance.
                </p>
              </div>

              <div class="footer">
                <p>This verification link will expire in 24 hours.</p>
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
    console.error(
      `[EMAIL ERROR] Failed to send verification email to ${email}`,
      JSON.stringify(errorDetails, null, 2),
    );
  }
}

async function sendPasswordResetOtpEmail(
  email: string,
  otp: string,
): Promise<void> {
  if (process.env.PRODUCTION === 'false') {
    console.log(`[DEV MODE] Password reset OTP for ${email}: ${otp}`);
    return;
  }

  const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY as string,
  });

  try {
    await client.transactionalEmails.sendTransacEmail({
      subject: 'Password Reset OTP | NutriTiffin',
      htmlContent: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset OTP</title>
            <style>
              body { font-family: 'Segoe UI', sans-serif; background-color: #f4f6f8; color: #333; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
              .otp-box { font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; text-align: center; margin: 30px 0; padding: 15px; background: #f3f4f6; border-radius: 6px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Password Reset Requested</h2>
              <p>You recently requested to reset your password for your NutriTiffin account. Use the OTP below to complete the reset process:</p>
              <div class="otp-box">${otp}</div>
              <p>This OTP is valid for 10 minutes. If you did not request a password reset, please ignore this email.</p>
            </div>
          </body>
        </html>
      `,
      sender: { name: 'NutriTiffin Security', email: 'nutritiffin.kitchen@gmail.com' },
      to: [{ email }],
    });
    console.log(`[EMAIL SENT] Password reset OTP sent to ${email}`);
  } catch (error: any) {
    console.error(
      `[EMAIL ERROR] Failed to send password reset OTP to ${email}`,
      JSON.stringify(error?.body || error?.response?.body || error, null, 2),
    );
  }
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private jwtService: JwtService,
    private redisService: RedisService,
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
      if (user.is_banned) {
        throw new ForbiddenException(
          'Your account has been banned. Please contact support@nutritiffin.com if you believe this is a mistake.',
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const isDevelopment = process.env.PRODUCTION === 'false';

    // Reject banned users
    if (user.is_banned) {
      throw new ForbiddenException(
        'Your account has been banned. Please contact support@nutritiffin.com if you believe this is a mistake.',
      );
    }

    // Reject unverified users (only in production)
    if (!isDevelopment && (!user.email_verified || !user.phone_verified)) {
      throw new ForbiddenException(
        'Account not fully verified. Both email and phone verification are required. Please use the /auth/verify-phone endpoint to verify your phone number.',
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
    const allowedDomains = ['gmail.com', 'yopmail.com', "hotmail.com"];
    const emailDomain = registerDto.email.split('@')[1]?.toLowerCase();

    if (!emailDomain || !allowedDomains.includes(emailDomain)) {
      throw new BadRequestException(
        `Email domain @${emailDomain || 'unknown'} is not allowed. Allowed domains are: ${allowedDomains.join(', ')}`,
      );
    }

    if (registerDto.role === UserRole.ADMIN) {
      const adminPass = process.env.ADMIN_ACCESS_PASS;
      if (
        !registerDto.admin_access_pass ||
        registerDto.admin_access_pass !== adminPass
      ) {
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
        registerDto.pincode,
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

    const isDevelopment = process.env.PRODUCTION === 'false';

    // Generate verification token and persist it
    const { token, expiresAt } = this.generateVerificationToken();
    user.email_verified = isDevelopment;
    user.phone_verified = isDevelopment;
    user.verify_token = token;
    user.verify_token_expires_at = expiresAt;
    await this.usersService.saveUser(user);

    if (!isDevelopment) {
      await sendVerificationEmail(user.email, token); // TODO: implement with Brevo
    } else {
      console.log(`[DEV MODE] Auto-verified user ${user.email}. Verification link: ${process.env.BASE_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`);
    }

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

    if (
      user.verify_token_expires_at &&
      user.verify_token_expires_at < new Date()
    ) {
      throw new BadRequestException(
        'Verification token has expired. Please request a new one.',
      );
    }

    user.email_verified = true;
    user.verify_token = null;
    user.verify_token_expires_at = null;
    await this.usersService.saveUser(user);

    const isDevelopment = process.env.PRODUCTION === 'false';
    if (!isDevelopment && user.phone_number) {
      // Wait 10 seconds before sending OTP (fire in background so we don't block the response)
      const phoneNumber = user.phone_number;
      setTimeout(() => {
        this.resendPhoneOtp({ phone: phoneNumber }).catch(err => {
          console.error('[SMS ERROR] Failed to send OTP during email verification', err);
        });
      }, 10000);
    }

    return { message: 'Email verified successfully. An OTP has been sent to your phone to complete verification.' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new NotFoundException('No account found with this email address');
    }

    if (user.email_verified) {
      throw new BadRequestException('Email is already verified');
    }

    // Regenerate token and expiry
    const { token, expiresAt } = this.generateVerificationToken();
    user.verify_token = token;
    user.verify_token_expires_at = expiresAt;
    await this.usersService.saveUser(user);

    await sendVerificationEmail(user.email, token);

    return {
      message: 'Verification email has been resent. Please check your inbox.',
    };
  }

  async checkEmailVerified(email: string): Promise<{ is_verified: boolean }> {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new NotFoundException('No account found with this email address');
    }

    return { is_verified: user.email_verified };
  }

  async deleteAccount(userId: string): Promise<{ message: string }> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    await this.usersService.deleteAccount(userId);
    return { message: 'Account deleted successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findOneByEmail(dto.email);
    if (!user) {
      // Do not reveal if the user exists for security reasons
      return { message: 'If the email is registered, an OTP has been sent.' };
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const redisKey = `reset_otp:${user.email.toLowerCase()}`;

    // Save to Redis with 10 minutes (600 seconds) expiry
    await this.redisService.client.setex(redisKey, 600, otp);

    // Send email (no need to await if we want to return fast, but standard await is safer)
    await sendPasswordResetOtpEmail(user.email, otp);

    return { message: 'If the email is registered, an OTP has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const redisKey = `reset_otp:${dto.email.toLowerCase()}`;
    const savedOtp = await this.redisService.client.get(redisKey);

    if (!savedOtp || savedOtp !== dto.otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const user = await this.usersService.findOneByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('Invalid request');
    }

    const salt = await bcrypt.genSalt();
    const newPasswordHash = await bcrypt.hash(dto.new_password, salt);

    user.password_hash = newPasswordHash;
    user.token_version += 1;
    await this.usersService.saveUser(user);

    // Clean up OTP
    await this.redisService.client.del(redisKey);

    return { message: 'Password has been changed successfully. You can now log in.' };
  }

  async resendPhoneOtp(dto: ResendPhoneOtpDto) {
    if (process.env.PRODUCTION === 'false') {
      const redisKey = `phone_verify_id:${dto.phone}`;
      await this.redisService.client.setex(redisKey, 300, 'dev-verification-id');
      console.log(`[DEV MODE] Phone confirm OTP bypass for ${dto.phone}. Use any 4-digit OTP to verify.`);
      return { message: 'OTP sent successfully (DEV MODE)' };
    }

    const customerId = process.env.SMS_CUSTOMER_ID;
    const authToken = process.env.SMS_API_KEY;

    if (!customerId || !authToken) {
      throw new BadRequestException('SMS service is not configured properly');
    }

    const countryCode = '91'; // We can default or extract from DTO if needed
    const url = `https://cpaas.messagecentral.com/verification/v3/send?customerId=${customerId}&mobileNumber=${dto.phone}&countryCode=${countryCode}&flowType=SMS&otpLength=4`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'authToken': authToken,
        },
      });

      let result: any = {};
      const responseText = await response.text();
      if (responseText) {
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          throw new BadRequestException(`Failed to parse SMS provider response (Status: ${response.status})`);
        }
      }

      if (response.ok && (result?.responseCode === 200 || result?.responseCode === '200')) {
        // Store verificationId in Redis temporarily (e.g., 5 mins)
        const redisKey = `phone_verify_id:${dto.phone}`;
        await this.redisService.client.setex(redisKey, 300, result.data.verificationId);

        return {
          message: 'OTP sent successfully',
        };
      }

      throw new BadRequestException(result?.message || result?.data?.errorMessage || `Failed to send OTP (Status: ${response.status})`);
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to communicate with SMS provider: ' + error.message);
    }
  }

  async verifyPhone(dto: VerifyPhoneDto) {
    const isDevelopment = process.env.PRODUCTION === 'false';
    const redisKey = `phone_verify_id:${dto.phone}`;

    if (isDevelopment) {
      // By-pass OTP completely in development
      const user = await this.usersService.findOneByPhoneNumber(dto.phone);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      user.phone_verified = true;
      await this.usersService.saveUser(user);
      await this.redisService.client.del(redisKey);

      return {
        message: 'Phone number bypassed successfully (DEV MODE)',
        verified: true,
      };
    }

    const verificationId = await this.redisService.client.get(redisKey);

    if (!verificationId) {
      throw new BadRequestException('OTP expired or not requested for this phone number');
    }

    const authToken = process.env.SMS_API_KEY;

    if (!authToken) {
      throw new BadRequestException('SMS service is not configured properly');
    }

    const url = `https://cpaas.messagecentral.com/verification/v3/validateOtp?verificationId=${verificationId}&code=${dto.otp}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'authToken': authToken,
        },
      });

      let result: any = {};
      const responseText = await response.text();
      if (responseText) {
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          throw new BadRequestException(`Failed to parse SMS provider response (Status: ${response.status})`);
        }
      }

      if (response.ok && (result?.responseCode === 200 || result?.responseCode === '200') && result?.data?.verificationStatus === 'VERIFICATION_COMPLETED') {
        const mobileNumber = result.data.mobileNumber;

        if (mobileNumber) {
          const user = await this.usersService.findOneByPhoneNumber(mobileNumber);
          if (!user) {
            throw new NotFoundException('User with this phone number not found');
          }

          user.phone_verified = true;
          await this.usersService.saveUser(user);

          // Clear temp store
          await this.redisService.client.del(redisKey);
        }

        return {
          message: 'Phone number verified successfully',
          verified: true,
        };
      }

      throw new BadRequestException(result?.data?.errorMessage || result?.message || `Invalid or expired OTP (Status: ${response.status})`);
    } catch (error: any) {
      if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to communicate with SMS provider: ' + error.message);
    }
  }
}
