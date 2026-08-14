import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../users/users.service';
import { CreateUserDto, LoginDto } from './dto/user.dto';
import { NodemailerService } from './nodemailer.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private nodemailerService: NodemailerService,
  ) {}

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async register(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.userService.create({
      ...createUserDto,
      password: hashedPassword,
    });
    const payload = { sub: user.id, email: user.email, name: user.name, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, name: user.name, role: user.role, classCode: user.classCode, joinedClassId: user.joinedClassId },
    };
  }

  async login(loginDto: LoginDto) {
    let user = await this.userService.findByEmail(loginDto.email);
    
    if (!user) {
      // Auto-register the user if they don't exist
      const emailPrefix = loginDto.email.split('@')[0];
      const displayName = loginDto.name || (emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      const randomPassword = Math.random().toString(36).substring(2, 15);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const code = this.generateOTP();

      user = await this.userService.create({
        email: loginDto.email,
        name: displayName,
        password: hashedPassword,
        role: loginDto.role as any,
      });

      // Update with unverified status and code
      await this.userService.update(user.id, {
        emailVerified: false,
        verificationCode: code,
      } as any);

      // Send verification email
      await this.nodemailerService.sendVerificationEmail(user.email, code);

      return {
        requiresVerification: true,
        email: user.email,
      };
    }

    if (!user.emailVerified) {
      const code = this.generateOTP();
      await this.userService.update(user.id, {
        verificationCode: code,
      } as any);
      await this.nodemailerService.sendVerificationEmail(user.email, code);

      return {
        requiresVerification: true,
        email: user.email,
      };
    }

    const payload = { sub: user.id, email: user.email, name: user.name, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, name: user.name, role: user.role, classCode: user.classCode, joinedClassId: user.joinedClassId },
    };
  }

  async verifyEmail(email: string, code: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.verificationCode !== code) {
      throw new BadRequestException('Invalid verification code');
    }

    const updatedUser = await this.userService.update(user.id, {
      emailVerified: true,
      verificationCode: null,
    } as any);

    const payload = { sub: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role, classCode: updatedUser.classCode, joinedClassId: updatedUser.joinedClassId },
    };
  }

  async loginOAuth(user: any) {
    const payload = { sub: user.id, email: user.email, name: user.name, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, name: user.name, role: user.role, classCode: user.classCode, joinedClassId: user.joinedClassId },
    };
  }

  validateUser(payload: any) {
    return { userId: payload.sub, email: payload.email, name: payload.name, role: payload.role };
  }
}
