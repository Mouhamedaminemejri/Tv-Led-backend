import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient, UserRole, AuthProvider } from '@prisma/client';
import { Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject('PRISMA') private prisma: PrismaClient,
    private jwtService: JwtService,
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
   */
  private generateAccessToken(userId: string, email: string, role: UserRole): string {
    const payload = {
      sub: userId,
      email,
      role,
    };

    return this.jwtService.sign(payload);
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
}
