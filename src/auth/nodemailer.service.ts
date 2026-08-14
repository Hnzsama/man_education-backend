import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NodemailerService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'ayokeloladiri@gmail.com',
        pass: process.env.EMAIL_PASS || 'njvr fofk rnpw ytqg',
      },
    });
  }

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    const mailOptions = {
      from: `"Man Education" <${process.env.EMAIL_USER || 'ayokeloladiri@gmail.com'}>`,
      to: email,
      subject: 'Email Verification Code - Man Education',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded-lg">
          <h2 style="color: #4f46e5; margin-bottom: 20px;">Verify Your Email</h2>
          <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">
            Thank you for registering at Man Education. Use the verification code below to complete your registration. This code will expire soon:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: bold; color: #1f2937; letter-spacing: 5px; background-color: #f3f4f6; padding: 10px 20px; border-radius: 6px;">
              ${code}
            </span>
          </div>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">
            If you did not request this, please ignore this email.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (err) {
      console.error('Nodemailer failed to send email:', err);
      throw new Error('Failed to send verification email');
    }
  }
}
