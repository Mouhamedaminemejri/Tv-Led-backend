import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient, UserRole, AuthProvider } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { CartService } from '../cart/cart.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject('PRISMA') private prisma: PrismaClient,
    private jwtService: JwtService,
    @Inject(forwardRef(() => CartService))
    private cartService: CartService,
  ) {}

  /**
   * Register a new user with email and password
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone,
        provider: AuthProvider.LOCAL,
        role: UserRole.CUSTOMER,
        emailVerified: false,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        provider: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Generate JWT tokens
    const accessToken = this.generateAccessToken(user.id, user.email, user.role);

    // Migrate guest cart if guestSessionId provided
    if (registerDto.guestSessionId) {
      try {
        await this.cartService.migrateGuestCartToUser(
          registerDto.guestSessionId,
          user.id,
        );
      } catch (error) {
        // Don't fail registration if cart migration fails
        console.error('Failed to migrate guest cart:', error);
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        phone: user.phone || undefined,
        avatar: user.avatar || undefined,
        role: user.role,
        provider: user.provider,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      accessToken,
    };
  }

  /**
   * Login with email and password
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has a password (OAuth users don't have passwords)
    if (!user.password) {
      throw new UnauthorizedException(
        'This account was created with social login. Please use social login to sign in.',
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Use 30 days expiration if rememberMe is true, otherwise use default (7 days)
    const expiresIn = loginDto.rememberMe ? '30d' : undefined;
    const accessToken = this.generateAccessToken(user.id, user.email, user.role, expiresIn);

    // Migrate guest cart if guestSessionId provided
    if (loginDto.guestSessionId) {
      try {
        await this.cartService.migrateGuestCartToUser(
          loginDto.guestSessionId,
          user.id,
        );
      } catch (error) {
        // Don't fail login if cart migration fails
        console.error('Failed to migrate guest cart:', error);
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        phone: user.phone || undefined,
        avatar: user.avatar || undefined,
        role: user.role,
        provider: user.provider,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      accessToken,
    };
  }

  /**
   * Validate local user credentials (used by LocalStrategy)
   */
  async validateLocalUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  /**
   * Validate and create/update OAuth user
   */
  async validateOAuthUser(
    provider: AuthProvider,
    providerId: string,
    email: string,
    firstName?: string | null,
    lastName?: string | null,
    avatar?: string | null,
    emailVerified: boolean = true,
  ) {
    // First, try to find user by provider and providerId
    let user = await this.prisma.user.findFirst({
      where: {
        provider,
        providerId,
      },
    });

    if (user) {
      // Update existing OAuth user
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: firstName || user.firstName,
          lastName: lastName || user.lastName,
          avatar: avatar || user.avatar,
          emailVerified: emailVerified || user.emailVerified,
        },
      });
    } else {
      // Check if user exists with this email (account linking)
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        // Link OAuth account to existing user
        user = await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            provider,
            providerId,
            firstName: firstName || existingUser.firstName,
            lastName: lastName || existingUser.lastName,
            avatar: avatar || existingUser.avatar,
            emailVerified: emailVerified || existingUser.emailVerified,
          },
        });
      } else {
        // Create new OAuth user
        user = await this.prisma.user.create({
          data: {
            email,
            firstName: firstName,
            lastName: lastName,
            avatar: avatar,
            provider,
            providerId,
            role: UserRole.CUSTOMER,
            emailVerified,
            isActive: true,
          },
        });
      }
    }

    return user;
  }

  /**
   * Generate JWT tokens for OAuth user
   */
  async generateJwtForOAuthUser(user: any): Promise<AuthResponseDto> {
    const accessToken = this.generateAccessToken(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        phone: user.phone || undefined,
        avatar: user.avatar || undefined,
        role: user.role,
        provider: user.provider,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      accessToken,
    };
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        bio: true,
        role: true,
        provider: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Get full user profile with addresses
   */
  async getFullProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: {
          orderBy: [
            { isDefault: 'desc' },
            { createdAt: 'desc' },
          ],
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { addresses, ...userData } = user;
    return {
      ...userData,
      addresses,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateDto: UpdateProfileDto) {
    // Check if email is being changed and if it's already taken
    if (updateDto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: updateDto.email },
      });

      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already in use');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(updateDto.email && { email: updateDto.email }),
        ...(updateDto.firstName !== undefined && { firstName: updateDto.firstName }),
        ...(updateDto.lastName !== undefined && { lastName: updateDto.lastName }),
        ...(updateDto.phone !== undefined && { phone: updateDto.phone }),
        ...(updateDto.bio !== undefined && { bio: updateDto.bio }),
        ...(updateDto.avatar !== undefined && { avatar: updateDto.avatar }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        provider: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Change password (only for local auth users)
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException('This account does not have a password set');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Generate access token
   * @param expiresIn Optional expiration time (e.g., '30d', '7d'). If not provided, uses default from JWT config
   */
  private generateAccessToken(
    userId: string,
    email: string,
    role: UserRole,
    expiresIn?: string,
  ): string {
    const payload = {
      sub: userId,
      email,
      role,
    };

    const options = expiresIn ? { expiresIn: expiresIn as any } : {};
    return this.jwtService.sign(payload, options);
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        avatar: true,
        provider: true,
        emailVerified: true,
      },
    });
  }

  /**
   * Get all users with pagination (Admin only)
   */
  async getAllUsers(
    page: number = 1,
    limit: number = 20,
    role?: UserRole,
    isActive?: boolean,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          role: true,
          provider: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get user by ID with cart (Admin only)
   */
  async getUserByIdWithCart(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        cart: true,
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            orderItems: {
              include: {
                product: true,
              },
            },
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Parse cart items if cart exists
    let cartItems = [];
    if (user.cart && user.cart.items) {
      try {
        cartItems = typeof user.cart.items === 'string' 
          ? JSON.parse(user.cart.items) 
          : user.cart.items;
      } catch (error) {
        cartItems = [];
      }
    }

    return {
      ...user,
      cart: user.cart
        ? {
            ...user.cart,
            items: cartItems,
          }
        : null,
    };
  }

  /**
   * Update user (Admin only)
   */
  async updateUserAdmin(
    userId: string,
    updateDto: UpdateProfileDto & { role?: UserRole; isActive?: boolean },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if email is being changed and if it's already taken
    if (updateDto.email && updateDto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: updateDto.email },
      });

      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: updateDto.email,
        firstName: updateDto.firstName,
        lastName: updateDto.lastName,
        phone: updateDto.phone,
        role: updateDto.role,
        isActive: updateDto.isActive,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        provider: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  /**
   * Update user status (Admin only)
   */
  async updateUserStatus(userId: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Update user avatar
   */
  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // TODO: Delete old avatar file if exists

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        avatar: true,
      },
    });
  }

  /**
   * Delete user avatar
   */
  async deleteAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // TODO: Delete avatar file from storage

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
    });
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(userId: string) {
    let preferences = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // Create default preferences
      preferences = await this.prisma.userPreferences.create({
        data: {
          userId,
          orderUpdates: true,
          promotions: false,
          newsletter: false,
          smsNotifications: false,
        },
      });
    }

    return {
      orderUpdates: preferences.orderUpdates,
      promotions: preferences.promotions,
      newsletter: preferences.newsletter,
      smsNotifications: preferences.smsNotifications,
    };
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    updateDto: UpdateNotificationPreferencesDto,
  ) {
    const existing = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (existing) {
      return this.prisma.userPreferences.update({
        where: { userId },
        data: updateDto,
      });
    } else {
      return this.prisma.userPreferences.create({
        data: {
          userId,
          orderUpdates: updateDto.orderUpdates ?? true,
          promotions: updateDto.promotions ?? false,
          newsletter: updateDto.newsletter ?? false,
          smsNotifications: updateDto.smsNotifications ?? false,
        },
      });
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: string, deleteDto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify password for local accounts
    if (user.provider === AuthProvider.LOCAL && user.password) {
      const isPasswordValid = await bcrypt.compare(
        deleteDto.password,
        user.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid password');
      }
    }

    // Delete user (cascade will delete related records)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return {
      message: 'Account scheduled for deletion. You will receive a confirmation email.',
    };
  }

  /**
   * Logout (JWT is stateless, so we just return success)
   * Frontend should clear tokens
   */
  async logout() {
    return {
      message: 'Logged out successfully',
    };
  }
}
