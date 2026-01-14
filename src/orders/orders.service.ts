import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Order, OrderStatus, PaymentMethod } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { CartService } from '../cart/cart.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject('PRISMA') private prisma: PrismaClient,
    private cartService: CartService,
  ) {}

  /**
   * Generate a unique order number
   */
  private generateOrderNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * Create order with transaction handling for high concurrency
   * Uses database transactions to ensure atomicity
   */
  async createOrder(
    createOrderDto: CreateOrderDto & { userId?: string | null; sessionId?: string | null },
  ): Promise<Order> {
    // Get cart - supports both authenticated and guest users
    const cartIdentifier = createOrderDto.userId
      ? { userId: createOrderDto.userId }
      : createOrderDto.sessionId
        ? { sessionId: createOrderDto.sessionId }
        : null;

    if (!cartIdentifier) {
      throw new BadRequestException('Either userId or sessionId must be provided');
    }

    const cart = await this.cartService.getCart(cartIdentifier);
    
    if (!cart.itemsWithProducts || cart.itemsWithProducts.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Filter out items with deleted products and convert to cart items format
    const validCartItems = cart.itemsWithProducts
      .filter((item) => item.product !== null)
      .map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));
    
    if (validCartItems.length === 0) {
      throw new BadRequestException('Cart contains only deleted products');
    }

    // Use Prisma transaction for atomic operations
    return await this.prisma.$transaction(
      async (tx) => {
        // Step 1: Validate all products exist and check stock availability
        const productUpdates: Array<{
          productId: string;
          quantity: number;
          currentStock: number;
          price: number;
        }> = [];

        for (const item of validCartItems) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new NotFoundException(
              `Product with ID ${item.productId} not found`,
            );
          }

          // Check stock availability with WHERE condition for atomic update
          if (product.stock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for product ${product.title}. Available: ${product.stock}, Requested: ${item.quantity}`,
            );
          }

          productUpdates.push({
            productId: product.id,
            quantity: item.quantity,
            currentStock: product.stock,
            price: product.price,
          });
        }

        // Step 2: Calculate total amount
        const totalAmount = productUpdates.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );

        // Step 3: Update stock atomically using WHERE condition
        // This ensures that if stock changed between check and update, transaction fails
        for (const item of productUpdates) {
          const updatedProduct = await tx.product.updateMany({
            where: {
              id: item.productId,
              stock: { gte: item.quantity }, // Only update if stock is still sufficient
            },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });

          if (updatedProduct.count === 0) {
            // Stock was insufficient - rollback transaction
            throw new BadRequestException(
              `Stock insufficient for product ${item.productId}. Another purchase may have occurred.`,
            );
          }
        }

        // Step 4: Create order
        const order = await tx.order.create({
          data: {
            userId: createOrderDto.userId || null,
            sessionId: createOrderDto.sessionId || null,
            orderNumber: this.generateOrderNumber(),
            status: OrderStatus.PENDING,
            paymentMethod: createOrderDto.paymentMethod,
            totalAmount,
            fullName: createOrderDto.fullName,
            cin: createOrderDto.cin,
            dateOfBirth: createOrderDto.dateOfBirth
              ? new Date(createOrderDto.dateOfBirth)
              : null,
            email: createOrderDto.email,
            phoneNumber: createOrderDto.phoneNumber,
            billingStreetAddress: createOrderDto.billingAddress.streetAddress,
            billingCity: createOrderDto.billingAddress.city,
            billingPostalCode: createOrderDto.billingAddress.postalCode,
            shippingStreetAddress: createOrderDto.shippingAddress.streetAddress,
            shippingCity: createOrderDto.shippingAddress.city,
            shippingPostalCode: createOrderDto.shippingAddress.postalCode,
            orderItems: {
              create: productUpdates.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.price,
                totalPrice: item.price * item.quantity,
              })),
            },
          },
          include: {
            orderItems: {
              include: {
                product: true,
              },
            },
          },
        });

        // Step 5: Clear cart after successful order (supports both user and guest)
        if (createOrderDto.userId) {
          await tx.cart.updateMany({
            where: { userId: createOrderDto.userId },
            data: { items: [] },
          });
        } else if (createOrderDto.sessionId) {
          await tx.cart.updateMany({
            where: { sessionId: createOrderDto.sessionId },
            data: { items: [] },
          });
        }

        this.logger.log(
          `Order created: ${order.orderNumber} for ${createOrderDto.userId ? `user ${createOrderDto.userId}` : `guest ${createOrderDto.sessionId}`}`,
        );

        return order;
      },
      {
        maxWait: 5000, // Maximum time to wait for a transaction slot
        timeout: 10000, // Maximum time the transaction can run
      },
    );
  }

  /**
   * Get order by ID
   */
  async getOrder(
    orderId: string,
    userId: string | null,
    sessionId: string | null,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Verify order ownership: either userId or sessionId must match
    const isOwner =
      (userId && order.userId === userId) ||
      (sessionId && order.sessionId === sessionId);

    if (!isOwner) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    return order;
  }

  /**
   * Get all orders for a user
   */
  async getUserOrders(userId: string): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get user orders with pagination
   */
  async getUserOrdersPaginated(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: OrderStatus,
  ): Promise<{
    data: Order[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all orders with pagination (Admin only)
   */
  async getAllOrders(
    page: number = 1,
    limit: number = 20,
    status?: OrderStatus,
    userId?: string,
  ): Promise<{
    data: Order[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get order by ID (Admin only - can access any order)
   */
  async getOrderById(orderId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    return order;
  }

  /**
   * Update order status (for admin use)
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });
  }
}

