import { UserRole, AuthProvider } from '@prisma/client';

export class AuthResponseDto {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
    role: UserRole;
    provider: AuthProvider;
    emailVerified: boolean;
    createdAt: Date;
  };
  accessToken: string;
}
