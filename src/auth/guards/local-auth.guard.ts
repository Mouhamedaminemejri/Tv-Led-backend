import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Local Authentication Guard (email/password)
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
