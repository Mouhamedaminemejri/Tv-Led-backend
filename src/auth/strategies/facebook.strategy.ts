import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('FACEBOOK_APP_ID');
    const clientSecret = configService.get<string>('FACEBOOK_APP_SECRET');
    const callbackURL = configService.get<string>('FACEBOOK_CALLBACK_URL') || 'http://localhost:3001/api/auth/facebook/callback';

    // Use placeholder values if not configured (prevents app crash)
    // The strategy will fail gracefully when actually used
    super({
      clientID: clientID || 'not-configured',
      clientSecret: clientSecret || 'not-configured',
      callbackURL,
      scope: ['email'],
      profileFields: ['emails', 'name', 'picture.type(large)'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    
    const user = {
      email: emails && emails[0] ? emails[0].value : null,
      firstName: name?.givenName || name?.familyName || '',
      lastName: name?.familyName || '',
      avatar: photos && photos[0] ? photos[0].value : null,
      provider: 'FACEBOOK',
      providerId: profile.id,
      emailVerified: true,
      accessToken,
    };

    done(null, user);
  }
}
