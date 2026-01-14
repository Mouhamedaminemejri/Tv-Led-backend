import {
  Injectable,
  ExecutionContext,
  CanActivate,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { GuestSessionService } from '../services/guest-session.service';

/**
 * Optional Authentication Guard
 * Allows both authenticated users (JWT) and guest users (guest token)
 * Sets request.user for authenticated users OR request.guestSessionId for guests
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private guestSessionService: GuestSessionService,
  ) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    // Try to extract guest token first
    const guestToken = this.guestSessionService.extractGuestTokenFromHeaders(
      request.headers,
    );

    // If guest token exists, set it on request and allow access
    if (guestToken) {
      request.guestSessionId = guestToken;
      request.isGuest = true;
      return true;
    }

    // If no guest token, try JWT authentication
    // This will call the JWT strategy's validate method
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // If JWT authentication failed but we have a guest token, allow guest access
    if (err || !user) {
      if (request.guestSessionId) {
        request.isGuest = true;
        return null; // No user, but guest is allowed
      }
      // No guest token and JWT failed - this is fine for optional auth
      // The endpoint can check if user or guestSessionId exists
      return null;
    }

    // JWT authentication succeeded
    request.isGuest = false;
    return user;
  }
}
