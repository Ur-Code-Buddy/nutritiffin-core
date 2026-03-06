import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from './user.role.enum';
import { UsersService } from './users.service';
import { TransactionsService } from '../transactions/transactions.service';
import { BrevoClient } from '@getbrevo/brevo';

async function sendBanNotificationEmail(
  email: string,
  name: string,
): Promise<void> {
  if (process.env.PRODUCTION === 'false') {
    console.log(`[DEV MODE] Ban notification email for ${email}`);
    return;
  }

  const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY as string,
  });

  try {
    await client.transactionalEmails.sendTransacEmail({
      subject: 'Your NutriTiffin Account Has Been Suspended',
      htmlContent: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Suspended | NutriTiffin</title>
            <style>
              body { font-family: 'Segoe UI', sans-serif; background-color: #f4f6f8; color: #333; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
              .header { background-color: #991b1b; padding: 28px 20px; text-align: center; }
              .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }
              .content { padding: 40px 35px; }
              .content h2 { margin-top: 0; font-size: 20px; color: #111827; }
              .content p { font-size: 15px; line-height: 1.7; color: #4b5563; margin-bottom: 16px; }
              .alert-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 20px; border-radius: 4px; margin: 24px 0; font-size: 14px; color: #991b1b; }
              .contact-box { background: #f3f4f6; border-radius: 6px; padding: 20px; margin: 24px 0; text-align: center; }
              .contact-box a { color: #2563eb; font-weight: 600; font-size: 16px; text-decoration: none; }
              .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>NutriTiffin</h1>
              </div>
              <div class="content">
                <h2>Account Suspended</h2>
                <p>Hi ${name},</p>
                <p>We regret to inform you that your NutriTiffin account has been suspended due to a violation of our terms of service or platform policies.</p>
                <div class="alert-box">
                  Your account access has been revoked. You will not be able to log in or use any NutriTiffin services until further notice.
                </div>
                <p>If you believe this action was taken in error, please reach out to our support team:</p>
                <div class="contact-box">
                  <a href="mailto:support@nutritiffin.com">support@nutritiffin.com</a>
                </div>
                <p>We take the safety and integrity of our platform seriously. Our team will review your case promptly upon receiving your appeal.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} NutriTiffin. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      sender: { name: 'NutriTiffin Security', email: 'nutritiffin.kitchen@gmail.com' },
      to: [{ email }],
    });
    console.log(`[EMAIL SENT] Ban notification sent to ${email}`);
  } catch (error: any) {
    console.error(
      `[EMAIL ERROR] Failed to send ban notification to ${email}`,
      JSON.stringify(error?.body || error?.response?.body || error, null, 2),
    );
  }
}

async function sendUnbanNotificationEmail(
  email: string,
  name: string,
): Promise<void> {
  if (process.env.PRODUCTION === 'false') {
    console.log(`[DEV MODE] Unban notification email for ${email}`);
    return;
  }

  const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY as string,
  });

  try {
    await client.transactionalEmails.sendTransacEmail({
      subject: 'Your NutriTiffin Account Has Been Reinstated',
      htmlContent: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Reinstated | NutriTiffin</title>
            <style>
              body { font-family: 'Segoe UI', sans-serif; background-color: #f4f6f8; color: #333; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
              .header { background-color: #166534; padding: 28px 20px; text-align: center; }
              .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }
              .content { padding: 40px 35px; }
              .content h2 { margin-top: 0; font-size: 20px; color: #111827; }
              .content p { font-size: 15px; line-height: 1.7; color: #4b5563; margin-bottom: 16px; }
              .success-box { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px 20px; border-radius: 4px; margin: 24px 0; font-size: 14px; color: #166534; }
              .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>NutriTiffin</h1>
              </div>
              <div class="content">
                <h2>Welcome Back!</h2>
                <p>Hi ${name},</p>
                <p>Great news! Your NutriTiffin account has been reinstated. You can now log in and use all NutriTiffin services as before.</p>
                <div class="success-box">
                  Your account is fully active again. Please log in with your existing credentials.
                </div>
                <p>We appreciate your patience and understanding. If you have any questions, feel free to contact us at support@nutritiffin.com.</p>
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
    console.log(`[EMAIL SENT] Unban notification sent to ${email}`);
  } catch (error: any) {
    console.error(
      `[EMAIL ERROR] Failed to send unban notification to ${email}`,
      JSON.stringify(error?.body || error?.response?.body || error, null, 2),
    );
  }
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly usersService: UsersService,
    private readonly txnService: TransactionsService,
  ) { }

  @Get('users')
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Post('credits/add')
  async addCredits(
    @Request() req: any,
    @Body() body: { username: string; credits: number },
  ) {
    const result = await this.txnService.addCredits(
      req.user.userId,
      body.username,
      body.credits,
    );
    return {
      message: `Added ${body.credits} credits to ${body.username}`,
      credits: result.user.credits,
      transaction: {
        id: result.transaction.id,
        short_id: result.transaction.short_id,
      },
    };
  }

  @Post('credits/deduct')
  async deductCredits(
    @Request() req: any,
    @Body() body: { username: string; credits: number },
  ) {
    const result = await this.txnService.deductCredits(
      req.user.userId,
      body.username,
      body.credits,
    );
    return {
      message: `Deducted ${body.credits} credits from ${body.username}`,
      credits: result.user.credits,
      transaction: {
        id: result.transaction.id,
        short_id: result.transaction.short_id,
      },
    };
  }

  @Post('users/:id/disable')
  async disableUser(@Param('id') id: string) {
    return this.usersService.updateStatus(id, false);
  }

  @Post('users/:id/enable')
  async enableUser(@Param('id') id: string) {
    return this.usersService.updateStatus(id, true);
  }

  @Post('users/:id/ban')
  async banUser(@Param('id') id: string) {
    const user = await this.usersService.banUser(id);
    // Send ban notification email in background
    sendBanNotificationEmail(user.email, user.name).catch((err) => {
      console.error('[EMAIL ERROR] Failed to send ban notification', err);
    });
    return {
      message: `User ${user.username} has been banned successfully`,
      user: {
        id: user.id,
        username: user.username,
        is_banned: user.is_banned,
      },
    };
  }

  @Post('users/:id/unban')
  async unbanUser(@Param('id') id: string) {
    const user = await this.usersService.unbanUser(id);
    // Send unban notification email in background
    sendUnbanNotificationEmail(user.email, user.name).catch((err) => {
      console.error('[EMAIL ERROR] Failed to send unban notification', err);
    });
    return {
      message: `User ${user.username} has been unbanned successfully`,
      user: {
        id: user.id,
        username: user.username,
        is_banned: user.is_banned,
      },
    };
  }
}
