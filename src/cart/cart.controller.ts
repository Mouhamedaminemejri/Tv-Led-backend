import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { CartService, CartWithProducts, CartIdentifier } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GuestSession } from '../auth/decorators/guest-session.decorator';
import { IsGuest } from '../auth/decorators/is-guest.decorator';

@Controller('cart')
@UseGuards(OptionalAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Helper to get cart identifier from request
   * Returns userId if authenticated, sessionId if guest
   */
  private getCartIdentifier(
    user: { id: string } | null,
    guestSessionId: string | null,
  ): CartIdentifier {
    if (user) {
      return { userId: user.id };
    } else if (guestSessionId) {
      return { sessionId: guestSessionId };
    } else {
      throw new BadRequestException(
        'Authentication required. Please provide JWT token or X-Guest-Token header.',
      );
    }
  }

  @Post()
  async addToCart(
    @Body() addToCartDto: AddToCartDto,
    @CurrentUser() user: { id: string } | null,
    @GuestSession() guestSessionId: string | null,
  ) {
    const identifier = this.getCartIdentifier(user, guestSessionId);
    return this.cartService.addToCart(addToCartDto, identifier);
  }

  @Get()
  async getCart(
    @CurrentUser() user: { id: string } | null,
    @GuestSession() guestSessionId: string | null,
  ): Promise<CartWithProducts> {
    const identifier = this.getCartIdentifier(user, guestSessionId);
    return this.cartService.getCart(identifier);
  }

  @Put('item/:productId')
  async updateCartItem(
    @Param('productId') productId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
    @CurrentUser() user: { id: string } | null,
    @GuestSession() guestSessionId: string | null,
  ) {
    const identifier = this.getCartIdentifier(user, guestSessionId);
    return this.cartService.updateCartItem(identifier, productId, updateCartItemDto);
  }

  @Delete('item/:productId')
  @HttpCode(HttpStatus.OK)
  async removeFromCart(
    @Param('productId') productId: string,
    @CurrentUser() user: { id: string } | null,
    @GuestSession() guestSessionId: string | null,
  ) {
    const identifier = this.getCartIdentifier(user, guestSessionId);
    return this.cartService.removeFromCart(identifier, productId);
  }
}
