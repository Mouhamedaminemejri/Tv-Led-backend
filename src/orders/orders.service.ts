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
  async createOrder(createOrderDto: CreateOrderDto): Promise<Order> {
    // Get user's cart
    const cart = await this.cartService.getCart(createOrderDto.userId);
    
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
            userId: createOrderDto.userId,
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

        // Step 5: Clear user's cart after successful order
        await tx.cart.update({
          where: { userId: createOrderDto.userId },
          data: { items: [] },
        });

        this.logger.log(
          `Order created: ${order.orderNumber} for user ${createOrderDto.userId}`,
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
  async getOrder(orderId: string, userId: string): Promise<Order> {
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

    // Verify order belongs to user
    if (order.userId !== userId) {
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

