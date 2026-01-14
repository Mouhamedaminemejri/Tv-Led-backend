import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { GuestSessionService } from './services/guest-session.service';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { CartModule } from '../cart/cart.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    PrismaModule,
    UploadModule,
    forwardRef(() => CartModule), // Forward ref to avoid circular dependency
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN') || '7d';
        return {
          secret: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production',
          signOptions: {
            expiresIn: expiresIn as any,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GuestSessionService,
    OptionalAuthGuard,
    JwtStrategy,
    LocalStrategy,
    // OAuth strategies are always loaded but will use placeholder values if not configured
    // They will return proper error messages when accessed without credentials
    GoogleStrategy,
    FacebookStrategy,
    // Apple strategy would be added here when properly configured
    // Apple Sign-In requires significant Apple Developer setup
  ],
  exports: [
    AuthService,
    GuestSessionService,
    OptionalAuthGuard,
    JwtModule,
  ],
})
export class AuthModule {}
