import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to check if the current request is from a guest user
 * Usage: @IsGuest() isGuest: boolean
 */
export const IsGuest = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.isGuest === true;
  },
);
