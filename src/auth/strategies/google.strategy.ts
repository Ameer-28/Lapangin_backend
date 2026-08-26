import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    const isDev = process.env.NODE_ENV === 'development' && !process.env.VERCEL;
    const defaultCallback = isDev
      ? 'http://localhost:3000/api/auth/google/callback'
      : 'https://lapangin-backend.vercel.app/api/auth/google/callback';

    const envCallback = configService.get<string>('GOOGLE_CALLBACK_URL');
    const callbackURL = (envCallback && (!envCallback.includes('localhost') || isDev))
      ? envCallback
      : defaultCallback;

    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'dummy',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'dummy',
      callbackURL,
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
        return done(new Error('No email returned from Google'), false);
      }
      const givenName = name?.givenName || '';
      const familyName = name?.familyName || '';
      const fullName = `${givenName} ${familyName}`.trim() || displayName || email.split('@')[0];
      const avatarUrl = photos && photos[0] ? photos[0].value : undefined;

      const user = {
        email,
        fullName,
        avatarUrl,
        accessToken,
      };
      (done as any)(null, user);
    } catch (err: any) {
      (done as any)(err, false);
    }
  }
}
