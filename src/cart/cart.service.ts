import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaClient, Cart, Product } from '@prisma/client';
import { AddToCartDto, AddToCartWithUserIdDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface CartWithProducts {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  items: CartItem[];
  itemsWithProducts: Array<CartItem & { product: Product | null }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartIdentifier {
  userId?: string;
  sessionId?: string;
}

@Injectable()
export class CartService {
  constructor(@Inject('PRISMA') private prisma: PrismaClient) {}

  /**
   * Get or create cart for authenticated user
   */
  private async getOrCreateUserCart(userId: string): Promise<Cart> {
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

  /**
   * Get or create cart for guest user
   */
  private async getOrCreateGuestCart(sessionId: string): Promise<Cart> {
    let cart = await this.prisma.cart.findUnique({
      where: { sessionId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          sessionId,
          items: [],
        },
      });
    }

    return cart;
  }

  /**
   * Get or create cart - supports both authenticated and guest users
   */
  private async getOrCreateCart(identifier: CartIdentifier): Promise<Cart> {
    if (identifier.userId) {
      return this.getOrCreateUserCart(identifier.userId);
    } else if (identifier.sessionId) {
      return this.getOrCreateGuestCart(identifier.sessionId);
    } else {
      throw new BadRequestException('Either userId or sessionId must be provided');
    }
  }

  /**
   * Find cart by identifier
   */
  private async findCart(identifier: CartIdentifier): Promise<Cart | null> {
    if (identifier.userId) {
      return this.prisma.cart.findUnique({
        where: { userId: identifier.userId },
      });
    } else if (identifier.sessionId) {
      return this.prisma.cart.findUnique({
        where: { sessionId: identifier.sessionId },
      });
    }
    return null;
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

  async addToCart(
    addToCartDto: AddToCartDto,
    identifier: CartIdentifier,
  ): Promise<Cart> {
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
    const cart = await this.getOrCreateCart(identifier);
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

  async updateCartItem(
    identifier: CartIdentifier,
    productId: string,
    updateCartItemDto: UpdateCartItemDto,
  ): Promise<Cart> {
    const cart = await this.getOrCreateCart(identifier);
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

  async removeFromCart(
    identifier: CartIdentifier,
    productId: string,
  ): Promise<Cart> {
    const cart = await this.getOrCreateCart(identifier);
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

  async getCart(identifier: CartIdentifier): Promise<CartWithProducts> {
    try {
      const cart = await this.findCart(identifier);

      // If cart doesn't exist, return empty structure
      if (!cart) {
        return {
          id: '',
          userId: identifier.userId || null,
          sessionId: identifier.sessionId || null,
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
        userId: cart.userId || null,
        sessionId: (cart as any).sessionId || null,
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
        userId: cart.userId || null,
        sessionId: (cart as any).sessionId || null,
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
        userId: identifier.userId || null,
        sessionId: identifier.sessionId || null,
        items: [],
        itemsWithProducts: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Merge guest cart into user cart when guest logs in/registers
   * Combines quantities for same products
   */
  async migrateGuestCartToUser(guestSessionId: string, userId: string): Promise<Cart> {
    const guestCart = await this.findCart({ sessionId: guestSessionId });
    const userCart = await this.findCart({ userId });

    // If no guest cart, just return user cart (or create it)
    if (!guestCart) {
      return this.getOrCreateUserCart(userId);
    }

    const guestItems = this.parseCartItems(guestCart.items);
    
    // If guest cart is empty, just delete it and return user cart
    if (guestItems.length === 0) {
      await this.prisma.cart.delete({
        where: { sessionId: guestSessionId },
      });
      return userCart || this.getOrCreateUserCart(userId);
    }

    // Get or create user cart
    const finalUserCart = userCart || await this.getOrCreateUserCart(userId);
    const userItems = this.parseCartItems(finalUserCart.items);

    // Merge items: combine quantities for same products
    const mergedItemsMap = new Map<string, CartItem>();

    // Add user items first
    userItems.forEach((item) => {
      mergedItemsMap.set(item.productId, { ...item });
    });

    // Merge guest items
    guestItems.forEach((guestItem) => {
      const existingItem = mergedItemsMap.get(guestItem.productId);
      if (existingItem) {
        // Combine quantities
        existingItem.quantity += guestItem.quantity;
      } else {
        // Add new item
        mergedItemsMap.set(guestItem.productId, { ...guestItem });
      }
    });

    const mergedItems = Array.from(mergedItemsMap.values());

    // Update user cart with merged items
    const updatedCart = await this.prisma.cart.update({
      where: { id: finalUserCart.id },
      data: { items: mergedItems as any },
    });

    // Delete guest cart
    await this.prisma.cart.delete({
      where: { sessionId: guestSessionId },
    }).catch(() => {
      // Ignore if already deleted
    });

    return updatedCart;
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
