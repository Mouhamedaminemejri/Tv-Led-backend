import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Put,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { Public } from './decorators/public.decorator';
import { UserRole, AuthProvider } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user
   * POST /api/auth/register
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Login with email and password
   * POST /api/auth/login
   */
  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @CurrentUser() user: any) {
    return this.authService.login(loginDto);
  }

  /**
   * Get current user profile
   * GET /api/auth/profile
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }

  /**
   * Update user profile
   * PUT /api/auth/profile
   */
  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, updateDto);
  }

  /**
   * Change password
   * PUT /api/auth/change-password
   */
  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, changePasswordDto);
  }

  /**
   * Google OAuth - Initiate login
   * GET /api/auth/google
   */
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth flow
    // If credentials are not configured, Passport will handle the error
  }

  /**
   * Google OAuth - Callback
   * GET /api/auth/google/callback
   */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const oauthUser = req.user as any;

    if (!oauthUser || !oauthUser.email) {
      return res.redirect(
        `${this.getFrontendUrl()}/auth/error?message=Failed to authenticate with Google`,
      );
    }

    try {
      const user = await this.authService.validateOAuthUser(
        AuthProvider.GOOGLE,
        oauthUser.providerId,
        oauthUser.email,
        oauthUser.firstName,
        oauthUser.lastName,
        oauthUser.avatar,
        oauthUser.emailVerified,
      );

      const { accessToken, user: userData } =
        await this.authService.generateJwtForOAuthUser(user);

      // Redirect to frontend with token
      return res.redirect(
        `${this.getFrontendUrl()}/auth/callback?token=${accessToken}&user=${encodeURIComponent(JSON.stringify(userData))}`,
      );
    } catch (error) {
      return res.redirect(
        `${this.getFrontendUrl()}/auth/error?message=${encodeURIComponent(error.message || 'Authentication failed')}`,
      );
    }
  }

  /**
   * Facebook OAuth - Initiate login
   * GET /api/auth/facebook
   */
  @Public()
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuth() {
    // Initiates Facebook OAuth flow
    // If credentials are not configured, Passport will handle the error
  }

  /**
   * Facebook OAuth - Callback
   * GET /api/auth/facebook/callback
   */
  @Public()
  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuthCallback(@Req() req: Request, @Res() res: Response) {
    const oauthUser = req.user as any;

    if (!oauthUser || !oauthUser.email) {
      return res.redirect(
        `${this.getFrontendUrl()}/auth/error?message=Failed to authenticate with Facebook. Email is required.`,
      );
    }

    try {
      const user = await this.authService.validateOAuthUser(
        AuthProvider.FACEBOOK,
        oauthUser.providerId,
        oauthUser.email,
        oauthUser.firstName,
        oauthUser.lastName,
        oauthUser.avatar,
        oauthUser.emailVerified,
      );

      const { accessToken, user: userData } =
        await this.authService.generateJwtForOAuthUser(user);

      return res.redirect(
        `${this.getFrontendUrl()}/auth/callback?token=${accessToken}&user=${encodeURIComponent(JSON.stringify(userData))}`,
      );
    } catch (error) {
      return res.redirect(
        `${this.getFrontendUrl()}/auth/error?message=${encodeURIComponent(error.message || 'Authentication failed')}`,
      );
    }
  }

  /**
   * Apple OAuth - Initiate login
   * GET /api/auth/apple
   * 
   * Note: Apple Sign-In requires significant Apple Developer setup.
   * See AUTH_ENVIRONMENT_SETUP.md for configuration instructions.
   */
  @Public()
  @Get('apple')
  async appleAuth(@Res() res: Response) {
    // Apple OAuth requires additional setup with Apple Developer account
    // This endpoint is a placeholder - implement when Apple OAuth is configured
    return res.status(501).json({
      statusCode: 501,
      message: 'Apple Sign-In is not yet configured. Please use Google or Facebook login, or configure Apple OAuth.',
      error: 'Not Implemented',
    });
  }

  /**
   * Apple OAuth - Callback
   * GET /api/auth/apple/callback
   * 
   * Note: Apple Sign-In requires significant Apple Developer setup.
   */
  @Public()
  @Get('apple/callback')
  async appleAuthCallback(@Res() res: Response) {
    return res.status(501).json({
      statusCode: 501,
      message: 'Apple Sign-In is not yet configured.',
      error: 'Not Implemented',
    });
  }

  /**
   * Admin only endpoint - Example
   * GET /api/auth/admin
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin')
  async adminOnly(@CurrentUser() user: any) {
    return {
      message: 'Admin access granted',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Get frontend URL from config or default
   */
  private getFrontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    );
  }
}
