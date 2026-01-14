import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract the guest session ID from the request
 * Usage: @GuestSession() sessionId: string | null
 */
export const GuestSession = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.guestSessionId || null;
  },
);
