import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { BrevoClient } from '@getbrevo/brevo';

async function sendProfileUpdateEmail(
  email: string,
  name: string,
  changedFields: string[],
): Promise<void> {
  if (process.env.PRODUCTION === 'false') {
    console.log(
      `[DEV MODE] Profile update notification for ${email}. Changed fields: ${changedFields.join(', ')}`,
    );
    return;
  }

  const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY as string,
  });

  const fieldLabels: Record<string, string> = {
    address: 'Address',
    pincode: 'Pincode',
    phone_number: 'Phone Number',
    profile_picture_url: 'Profile picture',
  };

  const changedList = changedFields.map((f) => fieldLabels[f] || f).join(', ');

  try {
    await client.transactionalEmails.sendTransacEmail({
      subject: 'Your NutriTiffin Profile Was Updated',
      htmlContent: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Profile Updated | NutriTiffin</title>
            <style>
              body { font-family: 'Segoe UI', sans-serif; background-color: #f4f6f8; color: #333; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
              .header { background-color: #1f2937; padding: 28px 20px; text-align: center; }
              .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }
              .content { padding: 40px 35px; }
              .content h2 { margin-top: 0; font-size: 20px; color: #111827; }
              .content p { font-size: 15px; line-height: 1.7; color: #4b5563; margin-bottom: 16px; }
              .field-list { background: #f3f4f6; border-radius: 6px; padding: 15px 20px; margin: 20px 0; font-size: 15px; color: #1f2937; font-weight: 600; }
              .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 20px 0; font-size: 14px; color: #92400e; }
              .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>NutriTiffin</h1>
              </div>
              <div class="content">
                <h2>Profile Updated</h2>
                <p>Hi ${name},</p>
                <p>Your NutriTiffin account details were recently updated. The following fields were changed:</p>
                <div class="field-list">${changedList}</div>
                <div class="warning">
                  If you did not make this change, please reset your password immediately and contact support at support@nutritiffin.com.
                </div>
                <p>This change was made on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} NutriTiffin. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      sender: { name: 'NutriTiffin', email: 'nutritiffin.kitchen@gmail.com' },
      to: [{ email }],
    });
    console.log(`[EMAIL SENT] Profile update notification sent to ${email}`);
  } catch (error: any) {
    console.error(
      `[EMAIL ERROR] Failed to send profile update notification to ${email}`,
      JSON.stringify(error?.body || error?.response?.body || error, null, 2),
    );
  }
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  @Throttle({
    default: { limit: 10, ttl: 60000 },
    hourly: { limit: 25, ttl: 3600000 },
  })
  @Get('check-username/:username')
  async checkUsername(@Param('username') username: string) {
    const user = await this.usersService.findOneByUsername(username);
    const suggested_username = await this.usersService.suggestAvailableUsername(
      username,
      !!user,
    );
    return { exists: !!user, suggested_username };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findOneById(req.user.userId);
    if (!user) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...result } = user;
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(
    @Request() req: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const { user, phoneChanged, changedFields } =
      await this.usersService.updateProfile(req.user.userId, updateProfileDto);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...result } = user;

    const response: any = {
      message: 'Profile updated successfully',
      user: result,
    };

    // If phone number was changed, trigger OTP for the new number
    if (phoneChanged && user.phone_number) {
      try {
        await this.authService.resendPhoneOtp({ phone: user.phone_number });
        response.message =
          'Profile updated successfully. An OTP has been sent to your new phone number for verification.';
        response.phone_verification_required = true;
      } catch (error) {
        response.message =
          'Profile updated, but failed to send OTP. Please use /auth/resend-phone-otp to verify your new phone number.';
        response.phone_verification_required = true;
      }
    }

    // Send notification email about the profile change (fire in background)
    if (changedFields.length > 0) {
      sendProfileUpdateEmail(user.email, user.name, changedFields).catch(
        (err) => {
          console.error(
            '[EMAIL ERROR] Failed to send profile update notification',
            err,
          );
        },
      );
    }

    return response;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/fcm-token')
  async updateFcmToken(@Request() req: any, @Body() body: any) {
    const token = body.fcm_token || body.fcmToken;
    console.log(
      `[FCM-TOKEN] Received FCM token for user ${req.user.userId}:`,
      token,
    );
    if (!token) {
      console.log(
        `[FCM-TOKEN] User ${req.user.userId} sent empty token request. Body:`,
        body,
      );
      return { success: false, message: 'Token is required' };
    }
    await this.usersService.updateFcmToken(req.user.userId, token);
    console.log(`[FCM-TOKEN] Token saved for user ${req.user.userId}`);
    return { success: true, message: 'FCM token updated successfully' };
  }
}
