import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * Service for managing guest session tokens
 * Guest tokens are UUIDs used to identify anonymous users
 */
@Injectable()
export class GuestSessionService {
  /**
   * Generate a new guest session token (UUID v4)
   */
  generateGuestToken(): string {
    return randomUUID();
  }

  /**
   * Validate guest token format
   * Guest tokens must be valid UUID v4 format
   */
  validateGuestToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidV4Regex.test(token);
  }

  /**
   * Extract guest token from request headers
   * Looks for 'X-Guest-Token' header
   */
  extractGuestTokenFromHeaders(headers: Record<string, string | string[] | undefined>): string | null {
    const guestToken = headers['x-guest-token'] || headers['X-Guest-Token'];
    
    if (!guestToken) {
      return null;
    }

    // Handle array case (shouldn't happen, but be safe)
    const token = Array.isArray(guestToken) ? guestToken[0] : guestToken;
    
    return this.validateGuestToken(token) ? token : null;
  }
}
