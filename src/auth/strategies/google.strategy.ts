import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'dummy',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'dummy',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3000/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { name, emails, photos, displayName } = profile || {};
      const email = emails && emails[0] ? emails[0].value : null;
      if (!email) {
        return done(new Error('No email returned from Google'), null);
      }
      const givenName = name?.givenName || '';
      const familyName = name?.familyName || '';
      const fullName = `${givenName} ${familyName}`.trim() || displayName || email.split('@')[0];
      const avatarUrl = photos && photos[0] ? photos[0].value : null;

      const user = {
        email,
        fullName,
        avatarUrl,
        accessToken,
      };
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
}
