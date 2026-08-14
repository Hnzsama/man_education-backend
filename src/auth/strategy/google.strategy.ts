import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { UserService } from '../../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private userService: UserService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '',
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { name, emails } = profile;
    const email = emails?.[0]?.value;

    if (!email) {
      return done(new Error('No email found from google profile'), null);
    }

    console.log('Google Profile data:', { photos: profile.photos, json: profile._json });
    const avatar = profile.photos?.[0]?.value || (profile._json as any)?.picture || undefined;

    let user = await this.userService.findByEmail(email);

    if (!user) {
      // Decode state parameter passed from client redirection
      const state = req.query.state;
      let role = 'INDIVIDUAL';
      let clientName = name?.givenName ? `${name.givenName} ${name.familyName || ''}`.trim() : email;

      if (state) {
        try {
          const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
          if (decoded.role === 'CLASS' || decoded.role === 'INDIVIDUAL') {
            role = decoded.role;
          }
          if (decoded.name && decoded.role === 'CLASS') {
            clientName = decoded.name;
          }
        } catch (err) {
          console.error('Error decoding Google OAuth state:', err);
        }
      }

      // Create user if not exists
      // Generate a random password since password field is required in Prisma schema
      const randomPassword = Math.random().toString(36).substring(2, 15);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      user = await this.userService.create({
        email,
        name: clientName,
        password: hashedPassword,
        avatar,
        role: role as any,
      });
    } else if (avatar && user.avatar !== avatar) {
      user = await this.userService.update(user.id, { avatar });
    }

    done(null, user);
  }
}
