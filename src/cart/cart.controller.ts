import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { CartService, CartWithProducts } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  async addToCart(@Body() addToCartDto: AddToCartDto) {
    return this.cartService.addToCart(addToCartDto);
  }

  @Get()
  async getCart(@Query('userId') userId: string): Promise<CartWithProducts> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.cartService.getCart(userId);
  }

  @Put('item/:productId')
  async updateCartItem(
    @Param('productId') productId: string,
    @Query('userId') userId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    // Pass productId from URL and DTO from body
    return this.cartService.updateCartItem(userId, productId, updateCartItemDto);
  }

  @Delete('item/:productId')
  @HttpCode(HttpStatus.OK)
  async removeFromCart(
    @Param('productId') productId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.cartService.removeFromCart(userId, productId);
  }
}
