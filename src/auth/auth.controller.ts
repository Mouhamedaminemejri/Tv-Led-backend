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
  Query,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { Public } from './decorators/public.decorator';
import { UserRole, AuthProvider } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { GuestSessionService } from './services/guest-session.service';
import { UploadService } from '../upload/upload.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly guestSessionService: GuestSessionService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Generate a guest session token
   * POST /api/auth/guest-token
   */
  @Public()
  @Post('guest-token')
  @HttpCode(HttpStatus.OK)
  async generateGuestToken() {
    return {
      guestToken: this.guestSessionService.generateGuestToken(),
      message: 'Guest token generated successfully',
    };
  }

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
  async login(@Body() loginDto: LoginDto) {
    // LocalAuthGuard validates credentials and sets req.user
    // The login logic is handled in AuthService
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
    // Check if Google OAuth is configured
    const clientID = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    
    if (!clientID || !clientSecret || clientID === 'not-configured' || clientSecret === 'not-configured') {
      // This will be caught by error handler, but Passport will try to redirect anyway
      // The strategy will handle the error gracefully
    }
    
    // Initiates Google OAuth flow - Passport will redirect to Google
    // If not configured, Passport will throw an error which we handle in the callback
  }

  /**
   * Google OAuth - Callback
   * GET /api/auth/google/callback
   */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const oauthUser = req.user as any;

      if (!oauthUser || !oauthUser.email) {
        const errorMessage = oauthUser?.error || 'Failed to authenticate with Google. Email is required.';
        return res.redirect(
          `${this.getFrontendUrl(req)}/auth/error?message=${encodeURIComponent(errorMessage)}`,
        );
      }

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
        `${this.getFrontendUrl(req)}/auth/callback?token=${accessToken}&user=${encodeURIComponent(JSON.stringify(userData))}`,
      );
    } catch (error: any) {
      console.error('Google OAuth callback error:', error);
      return res.redirect(
        `${this.getFrontendUrl(req)}/auth/error?message=${encodeURIComponent(error?.message || 'Authentication failed')}`,
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
    // Check if Facebook OAuth is configured
    const appID = this.configService.get<string>('FACEBOOK_APP_ID');
    const appSecret = this.configService.get<string>('FACEBOOK_APP_SECRET');
    
    if (!appID || !appSecret || appID === 'not-configured' || appSecret === 'not-configured') {
      // This will be caught by error handler, but Passport will try to redirect anyway
      // The strategy will handle the error gracefully
    }
    
    // Initiates Facebook OAuth flow - Passport will redirect to Facebook
    // If not configured, Passport will throw an error which we handle in the callback
  }

  /**
   * Facebook OAuth - Callback
   * GET /api/auth/facebook/callback
   */
  @Public()
  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuthCallback(@Req() req: Request, @Res() res: Response) {
    try {
      // Check if OAuth credentials are configured
      const appID = this.configService.get<string>('FACEBOOK_APP_ID');
      const appSecret = this.configService.get<string>('FACEBOOK_APP_SECRET');
      
      if (!appID || !appSecret || appID === 'not-configured' || appSecret === 'not-configured') {
        return res.redirect(
          `${this.getFrontendUrl(req)}/auth/error?message=${encodeURIComponent('Facebook OAuth is not configured. Please contact administrator.')}`,
        );
      }

      const oauthUser = req.user as any;

      if (!oauthUser || !oauthUser.email) {
        const errorMessage = oauthUser?.error || 'Failed to authenticate with Facebook. Email is required.';
        return res.redirect(
          `${this.getFrontendUrl(req)}/auth/error?message=${encodeURIComponent(errorMessage)}`,
        );
      }

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
        `${this.getFrontendUrl(req)}/auth/callback?token=${accessToken}&user=${encodeURIComponent(JSON.stringify(userData))}`,
      );
    } catch (error: any) {
      console.error('Facebook OAuth callback error:', error);
      return res.redirect(
        `${this.getFrontendUrl(req)}/auth/error?message=${encodeURIComponent(error?.message || 'Authentication failed')}`,
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
   * Get all users (Admin only)
   * GET /api/auth/admin/users
   * Query params: page, limit, role, isActive
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/users')
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const isActiveFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.authService.getAllUsers(pageNum, limitNum, role, isActiveFilter);
  }

  /**
   * Get user by ID with cart (Admin only)
   * GET /api/auth/admin/users/:id
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/users/:id')
  async getUserById(@Param('id') id: string) {
    return this.authService.getUserByIdWithCart(id);
  }

  /**
   * Update user (Admin only)
   * PUT /api/auth/admin/users/:id
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('admin/users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateDto: UpdateProfileDto & { role?: UserRole; isActive?: boolean },
  ) {
    return this.authService.updateUserAdmin(id, updateDto);
  }

  /**
   * Deactivate/Activate user (Admin only)
   * PUT /api/auth/admin/users/:id/status
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('admin/users/:id/status')
  async updateUserStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.authService.updateUserStatus(id, isActive);
  }

  /**
   * Upload avatar
   * POST /api/auth/avatar
   */
  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async uploadAvatar(
    @CurrentUser() user: { id: string },
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    // Upload file to storage
    const filePath = await this.uploadService.uploadFile(file, 'avatars');
    const avatarUrl = this.uploadService.getFileUrl(filePath);

    // Update user avatar
    await this.authService.updateAvatar(user.id, avatarUrl);

    return {
      avatarUrl,
    };
  }

  /**
   * Delete avatar
   * DELETE /api/auth/avatar
   */
  @UseGuards(JwtAuthGuard)
  @Delete('avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAvatar(@CurrentUser() user: { id: string }) {
    await this.authService.deleteAvatar(user.id);
  }

  /**
   * Get notification preferences
   * GET /api/auth/preferences/notifications
   */
  @UseGuards(JwtAuthGuard)
  @Get('preferences/notifications')
  async getNotificationPreferences(@CurrentUser() user: { id: string }) {
    return this.authService.getNotificationPreferences(user.id);
  }

  /**
   * Update notification preferences
   * PUT /api/auth/preferences/notifications
   */
  @UseGuards(JwtAuthGuard)
  @Put('preferences/notifications')
  async updateNotificationPreferences(
    @CurrentUser() user: { id: string },
    @Body() updateDto: UpdateNotificationPreferencesDto,
  ) {
    return this.authService.updateNotificationPreferences(user.id, updateDto);
  }

  /**
   * Delete account
   * POST /api/auth/delete-account
   */
  @UseGuards(JwtAuthGuard)
  @Post('delete-account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser() user: { id: string },
    @Body() deleteDto: DeleteAccountDto,
  ) {
    return this.authService.deleteAccount(user.id, deleteDto);
  }

  /**
   * Logout
   * POST /api/auth/logout
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: { id: string }) {
    // JWT is stateless, so we just return success
    // Frontend should clear tokens from localStorage
    return this.authService.logout();
  }

  /**
   * Get frontend URL from config or default
   * Supports multiple origins and checks request origin
   */
  private getFrontendUrl(req?: Request): string {
    // Check if request has origin header (from frontend)
    if (req?.headers?.origin) {
      return req.headers.origin;
    }
    
    // Check environment variable
    const envUrl = this.configService.get<string>('FRONTEND_URL');
    if (envUrl) {
      return envUrl;
    }
    
    // Default fallback
    return 'http://localhost:8080';
  }
}
