import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: Transporter;
  private readonly logger = new Logger(MailService.name);
  private readonly fromAddress: string;
  private readonly frontendUrl: string;
  private readonly instanceName: string;

  constructor(private configService: ConfigService) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:11103');
    this.fromAddress = this.configService.get<string>('MAIL_FROM', 'noreply@localhost');
    this.instanceName = this.configService.get<string>('INSTANCE_NAME', 'illo');

    // 開発環境: MailHog/MailCatcher または ethereal.email
    // 本番環境: SMTP設定
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      // 本番環境: SMTP設定
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST'),
        port: this.configService.get<number>('SMTP_PORT', 587),
        secure: this.configService.get<string>('SMTP_SECURE') === 'true', // true for 465, false for other ports
        auth: {
          user: this.configService.get<string>('SMTP_USER'),
          pass: this.configService.get<string>('SMTP_PASS'),
        },
      });
    } else {
      // 開発環境: MailHog (デフォルト: localhost:1025)
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST', 'localhost'),
        port: this.configService.get<number>('SMTP_PORT', 1025),
        secure: false,
        ignoreTLS: true,
      });
    }

    this.logger.log('Mail service initialized');
  }

  /**
   * メール認証メール送信
   */
  async sendVerificationEmail(email: string, username: string, token: string) {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: email,
        subject: `アカウント認証 - ${this.instanceName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #0096fa;">${this.instanceName}</h1>
            <h2>アカウント認証</h2>
            <p>こんにちは、${username}さん</p>
            <p>アカウントの登録ありがとうございます。以下のリンクをクリックして、メールアドレスの認証を完了してください。</p>
            <p>
              <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0096fa; color: white; text-decoration: none; border-radius: 4px;">
                メールアドレスを認証
              </a>
            </p>
            <p>または、以下のURLをブラウザにコピー＆ペーストしてください:</p>
            <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
            <p style="color: #999; font-size: 14px;">このリンクは24時間有効です。</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
            <p style="color: #999; font-size: 12px;">
              このメールに心当たりがない場合は、無視してください。
            </p>
          </div>
        `,
      });

      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}`, error);
      throw error;
    }
  }

  /**
   * パスワードリセットメール送信
   */
  async sendPasswordResetEmail(email: string, username: string, token: string) {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: email,
        subject: `パスワードリセット - ${this.instanceName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #0096fa;">${this.instanceName}</h1>
            <h2>パスワードリセット</h2>
            <p>こんにちは、${username}さん</p>
            <p>パスワードリセットのリクエストを受け付けました。以下のリンクをクリックして、新しいパスワードを設定してください。</p>
            <p>
              <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0096fa; color: white; text-decoration: none; border-radius: 4px;">
                パスワードをリセット
              </a>
            </p>
            <p>または、以下のURLをブラウザにコピー＆ペーストしてください:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p style="color: #999; font-size: 14px;">このリンクは1時間有効です。</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
            <p style="color: #999; font-size: 12px;">
              このメールに心当たりがない場合は、無視してください。パスワードは変更されません。
            </p>
          </div>
        `,
      });

      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}`, error);
      throw error;
    }
  }

  /**
   * 新しいデバイスからのログイン通知
   */
  async sendNewDeviceLoginNotification(
    email: string,
    username: string,
    deviceInfo: {
      deviceName?: string;
      ipAddress?: string;
      location?: string;
    },
  ) {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: email,
        subject: `新しいデバイスからのログイン - ${this.instanceName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #0096fa;">${this.instanceName}</h1>
            <h2>新しいデバイスからのログインを検出</h2>
            <p>こんにちは、${username}さん</p>
            <p>新しいデバイスからアカウントへのログインがありました。</p>
            <ul style="background-color: #f5f5f5; padding: 16px; border-radius: 4px;">
              ${deviceInfo.deviceName ? `<li><strong>デバイス:</strong> ${deviceInfo.deviceName}</li>` : ''}
              ${deviceInfo.ipAddress ? `<li><strong>IPアドレス:</strong> ${deviceInfo.ipAddress}</li>` : ''}
              ${deviceInfo.location ? `<li><strong>場所:</strong> ${deviceInfo.location}</li>` : ''}
            </ul>
            <p>このログインに心当たりがある場合は、何もする必要はありません。</p>
            <p>心当たりがない場合は、直ちにパスワードを変更し、アカウント設定で不審なセッションを無効化してください。</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
            <p style="color: #999; font-size: 12px;">
              このメールは自動送信されています。
            </p>
          </div>
        `,
      });

      this.logger.log(`New device login notification sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send new device login notification to ${email}`, error);
      throw error;
    }
  }
}
