import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaClient, Cart, Product } from '@prisma/client';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface CartWithProducts {
  id: string;
  userId: string;
  items: CartItem[];
  itemsWithProducts: Array<CartItem & { product: Product | null }>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CartService {
  constructor(@Inject('PRISMA') private prisma: PrismaClient) {}

  private async getOrCreateCart(userId: string): Promise<Cart> {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          userId,
          items: [],
        },
      });
    }

    return cart;
  }

  private parseCartItems(items: any): CartItem[] {
    try {
      if (!items) {
        return [];
      }
      
      // Handle Prisma JSON type
      if (typeof items === 'string') {
        const parsed = JSON.parse(items);
        return Array.isArray(parsed) ? parsed as CartItem[] : [];
      }
      
      if (Array.isArray(items)) {
        return items as CartItem[];
      }
      
      return [];
    } catch (error) {
      // If parsing fails, return empty array
      return [];
    }
  }

  async addToCart(addToCartDto: AddToCartDto): Promise<Cart> {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: addToCartDto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${addToCartDto.productId} not found`);
    }

    // Check if product is in stock
    if (product.stock < addToCartDto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${product.stock}, Requested: ${addToCartDto.quantity}`,
      );
    }

    // Get or create cart
    const cart = await this.getOrCreateCart(addToCartDto.userId);
    const items = this.parseCartItems(cart.items);

    // Check if product already exists in cart
    const existingItemIndex = items.findIndex(
      (item) => item.productId === addToCartDto.productId,
    );

    if (existingItemIndex >= 0) {
      // Update quantity if item already exists
      const newQuantity = items[existingItemIndex].quantity + addToCartDto.quantity;

      if (product.stock < newQuantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${product.stock}, Requested total: ${newQuantity}`,
        );
      }

      items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item
      items.push({
        productId: addToCartDto.productId,
        quantity: addToCartDto.quantity,
      });
    }

    // Update cart
    return this.prisma.cart.update({
      where: { id: cart.id },
      data: { items: items as any },
    });
  }

  async updateCartItem(userId: string, productId: string, updateCartItemDto: UpdateCartItemDto): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);
    const items = this.parseCartItems(cart.items);

    // Find the item
    const itemIndex = items.findIndex(
      (item) => item.productId === productId,
    );

    if (itemIndex === -1) {
      throw new NotFoundException(
        `Product with ID ${productId} not found in cart`,
      );
    }

    // Verify product exists and check stock
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      // Product was deleted, remove from cart
      items.splice(itemIndex, 1);
    } else {
      // Check stock availability
      if (product.stock < updateCartItemDto.quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${product.stock}, Requested: ${updateCartItemDto.quantity}`,
        );
      }

      // Update quantity
      items[itemIndex].quantity = updateCartItemDto.quantity;
    }

    // Update cart
    return this.prisma.cart.update({
      where: { id: cart.id },
      data: { items: items as any },
    });
  }

  async removeFromCart(userId: string, productId: string): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);
    const items = this.parseCartItems(cart.items);

    // Find and remove the item
    const itemIndex = items.findIndex((item) => item.productId === productId);

    if (itemIndex === -1) {
      throw new NotFoundException(`Product with ID ${productId} not found in cart`);
    }

    items.splice(itemIndex, 1);

    // Update cart
    return this.prisma.cart.update({
      where: { id: cart.id },
      data: { items: items as any },
    });
  }

  async getCart(userId: string): Promise<CartWithProducts> {
    try {
      const cart = await this.prisma.cart.findUnique({
        where: { userId },
      });

      // If cart doesn't exist, return empty structure
      if (!cart) {
        return {
          id: '',
          userId,
          items: [],
          itemsWithProducts: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      const items = this.parseCartItems(cart.items);

      // If no items, return empty structure
      if (items.length === 0) {
        return {
          id: cart.id,
          userId: cart.userId,
          items: [],
          itemsWithProducts: [],
          createdAt: cart.createdAt,
          updatedAt: cart.updatedAt,
        };
      }

      // Fetch product details for each item
      const itemsWithProducts = await Promise.all(
        items.map(async (item) => {
          try {
            const product = await this.prisma.product.findUnique({
              where: { id: item.productId },
            });

            // If product was deleted, still return the item but with null product
            return {
              ...item,
              product: product || null,
            };
          } catch (error) {
            // If product fetch fails, return item with null product
            return {
              ...item,
              product: null,
            };
          }
        }),
      );

      return {
        id: cart.id,
        userId: cart.userId,
        items,
        itemsWithProducts,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
      };
    } catch (error) {
      // Log error for debugging
      console.error('Error in getCart:', error);
      // Return empty structure on any error
      return {
        id: '',
        userId,
        items: [],
        itemsWithProducts: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  async syncCartOnProductUpdate(productId: string): Promise<void> {
    // When a product is updated, carts are automatically synced on next getCart call
    // Product updates (like stock changes) are handled during add/update operations
    // This method is here for future use if needed for more complex sync logic
  }

  async syncCartOnProductDelete(productId: string): Promise<void> {
    // Remove product from all carts when it's deleted
    const carts = await this.prisma.cart.findMany();

    for (const cart of carts) {
      const items = this.parseCartItems(cart.items);
      const filteredItems = items.filter((item) => item.productId !== productId);

      if (filteredItems.length !== items.length) {
        await this.prisma.cart.update({
          where: { id: cart.id },
          data: { items: filteredItems as any },
        });
      }
    }
  }
}
