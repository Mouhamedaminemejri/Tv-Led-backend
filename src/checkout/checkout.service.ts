import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Order, PaymentStatus, PaymentMethod } from '@prisma/client';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { OrdersService } from '../orders/orders.service';
import { PaykassmaService } from './services/paykassma.service';
import { KonnectService } from './services/konnect.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    @Inject('PRISMA') private prisma: PrismaClient,
    private ordersService: OrdersService,
    private paykassmaService: PaykassmaService,
    private konnectService: KonnectService,
    private configService: ConfigService,
  ) {}

  /**
   * Initiate payment process
   * Creates order and payment record, then initiates payment gateway
   */
  async initiatePayment(
    initiatePaymentDto: InitiatePaymentDto,
    userId: string | null = null,
    sessionId: string | null = null,
  ): Promise<{
    order: Order;
    paymentUrl?: string;
    message: string;
  }> {
    // Step 1: Create order first
    const order = await this.ordersService.createOrder({
      userId,
      sessionId,
      paymentMethod: initiatePaymentDto.paymentMethod,
      fullName: initiatePaymentDto.fullName,
      cin: initiatePaymentDto.cin,
      dateOfBirth: initiatePaymentDto.dateOfBirth,
      email: initiatePaymentDto.email,
      phoneNumber: initiatePaymentDto.phoneNumber,
      billingAddress: initiatePaymentDto.billingAddress,
      shippingAddress: initiatePaymentDto.shippingAddress,
    });

    // Step 2: Handle payment based on method
    if (
      initiatePaymentDto.paymentMethod === PaymentMethod.CASH_ON_DELIVERY
    ) {
      // For cash on delivery, just create payment record
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          status: PaymentStatus.PENDING,
          amount: order.totalAmount,
          currency: 'TND',
        },
      });

      return {
        order,
        message: 'Order created successfully. Payment will be collected on delivery.',
      };
    }

    // Step 3: For card payments, initiate payment gateway
    if (
      initiatePaymentDto.paymentMethod === PaymentMethod.CREDIT_DEBIT_CARD ||
      initiatePaymentDto.paymentMethod === PaymentMethod.PAYKASSMA
    ) {
      return await this.initiateCardPayment(order, initiatePaymentDto);
    }

    // Step 4: For mobile payment (D17, Flouci)
    if (initiatePaymentDto.paymentMethod === PaymentMethod.MOBILE_PAYMENT) {
      // Similar to card payment, initiate mobile payment gateway
      return await this.initiateMobilePayment(order, initiatePaymentDto);
    }

    throw new BadRequestException('Invalid payment method');
  }

  /**
   * Initiate card payment via Paykassma
   */
  private async initiateCardPayment(
    order: Order,
    initiatePaymentDto: InitiatePaymentDto,
  ): Promise<{
    order: Order;
    paymentUrl: string;
    message: string;
  }> {
    const backendBaseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3001';
    const frontendBaseUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('APP_URL') ||
      'http://localhost:3000';

    const callbackUrl = `${backendBaseUrl}/api/checkout/payment/callback`;
    const returnUrl = `${frontendBaseUrl}/checkout/success?orderId=${order.id}`;

    // Initiate payment with Paykassma
    const paymentResponse = await this.paykassmaService.initiatePayment(
      order.totalAmount,
      order.orderNumber,
      initiatePaymentDto.email,
      initiatePaymentDto.fullName,
      callbackUrl,
      returnUrl,
    );

    if (!paymentResponse.success) {
      this.logger.error('Payment initiation failed', {
        orderId: order.id,
        error: paymentResponse.error,
      });
      throw new BadRequestException(
        paymentResponse.error || 'Failed to initiate payment',
      );
    }

    if (!paymentResponse.paymentUrl) {
      this.logger.warn('Payment initiated but no payment URL returned', {
        orderId: order.id,
        response: paymentResponse,
      });
      throw new BadRequestException(
        'Payment gateway did not return a payment URL',
      );
    }

    // Create payment record
    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: initiatePaymentDto.paymentMethod,
        status: PaymentStatus.PENDING,
        amount: order.totalAmount,
        currency: 'TND',
        gatewayTransactionId: paymentResponse.transactionId,
        paymentUrl: paymentResponse.paymentUrl,
        callbackUrl,
      },
    });

    return {
      order,
      paymentUrl: paymentResponse.paymentUrl,
      message: 'Payment initiated successfully. Please complete the payment.',
    };
  }

  /**
   * Initiate mobile payment (placeholder for D17/Flouci integration)
   */
  private async initiateMobilePayment(
    order: Order,
    initiatePaymentDto: InitiatePaymentDto,
  ): Promise<{
    order: Order;
    paymentUrl?: string;
    message: string;
  }> {
    const baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3001';
    const frontendBaseUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('APP_URL') ||
      'http://localhost:3000';

    const callbackUrl = `${baseUrl}/api/checkout/payment/callback?gateway=konnect`;
    const successUrl = `${frontendBaseUrl}/checkout/success?orderId=${order.id}&gateway=konnect`;
    const failUrl = `${frontendBaseUrl}/checkout/fail?orderId=${order.id}&gateway=konnect`;

    const paymentResponse = await this.konnectService.initiatePayment({
      amountTnd: order.totalAmount,
      orderNumber: order.orderNumber,
      fullName: initiatePaymentDto.fullName,
      email: initiatePaymentDto.email,
      phoneNumber: initiatePaymentDto.phoneNumber,
      successUrl,
      failUrl,
      callbackUrl,
    });

    if (!paymentResponse.success || !paymentResponse.paymentUrl) {
      this.logger.error('Konnect payment initiation failed', {
        orderId: order.id,
        error: paymentResponse.error,
      });
      throw new BadRequestException(
        paymentResponse.error || 'Failed to initiate mobile payment',
      );
    }

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: PaymentMethod.MOBILE_PAYMENT,
        status: PaymentStatus.PENDING,
        amount: order.totalAmount,
        currency: 'TND',
        gatewayTransactionId: paymentResponse.paymentRef,
        paymentUrl: paymentResponse.paymentUrl,
        callbackUrl,
      },
    });

    return {
      order,
      paymentUrl: paymentResponse.paymentUrl,
      message: 'Mobile payment initiated successfully. Please complete payment.',
    };
  }

  /**
   * Handle payment callback from gateway
   */
  async handlePaymentCallback(
    gatewayData: any,
    gateway: 'paykassma' | 'konnect' | 'mobile' = 'paykassma',
  ): Promise<{ success: boolean; orderId?: string }> {
    try {
      let verificationResult;

      if (gateway === 'paykassma') {
        verificationResult = await this.paykassmaService.verifyCallback(
          gatewayData,
        );
      } else if (gateway === 'konnect' || gateway === 'mobile') {
        verificationResult = await this.konnectService.verifyCallback(
          gatewayData,
        );
      } else {
        throw new BadRequestException('Unsupported payment gateway');
      }

      if (!verificationResult.success || !verificationResult.orderId) {
        this.logger.warn('Payment callback verification failed', gatewayData);
        return { success: false };
      }

      // Find order by order number
      const order = await this.prisma.order.findUnique({
        where: { orderNumber: verificationResult.orderId },
        include: { payment: true },
      });

      if (!order || !order.payment) {
        this.logger.error('Order or payment not found', verificationResult);
        return { success: false };
      }

      // Update payment status
      const paymentStatus =
        verificationResult.status === 'success' ||
        verificationResult.status === 'paid' ||
        verificationResult.status === 'completed' ||
        verificationResult.status === 'approved'
          ? PaymentStatus.SUCCESS
          : PaymentStatus.FAILED;

      await this.prisma.payment.update({
        where: { orderId: order.id },
        data: {
          status: paymentStatus,
          gatewayResponse: gatewayData,
          paidAt:
            paymentStatus === PaymentStatus.SUCCESS ? new Date() : null,
        },
      });

      // Update order status if payment successful
      if (paymentStatus === PaymentStatus.SUCCESS) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'CONFIRMED' },
        });
      }

      this.logger.log(
        `Payment ${paymentStatus} for order ${order.orderNumber}`,
      );

      return { success: true, orderId: order.id };
    } catch (error) {
      this.logger.error('Error handling payment callback', error);
      return { success: false };
    }
  }

  async handleKonnectWebhook(
    callbackData: any,
    signature?: string,
  ): Promise<{ success: boolean; orderId?: string }> {
    const signatureValid = this.konnectService.verifyWebhookSignature(
      callbackData,
      signature,
    );

    if (!signatureValid) {
      this.logger.warn('Rejected Konnect webhook due to invalid signature.');
      return { success: false };
    }

    return this.handlePaymentCallback(callbackData, 'konnect');
  }

  /**
   * Get payment status for an order
   */
  async getPaymentStatus(
    orderId: string,
    userId: string | null,
    sessionId: string | null,
  ): Promise<{
    paymentStatus: PaymentStatus;
    paymentUrl?: string;
    orderStatus: string;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Verify ownership: either userId or sessionId must match
    const isOwner =
      (userId && order.userId === userId) ||
      (sessionId && (order as any).sessionId === sessionId);

    if (!isOwner) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    return {
      paymentStatus: order.payment?.status || PaymentStatus.PENDING,
      paymentUrl: order.payment?.paymentUrl || undefined,
      orderStatus: order.status,
    };
  }

  /**
   * Handle mock payment success (for testing without real payment gateway)
   */
  async handleMockPaymentSuccess(
    orderId: string,
    transactionId?: string,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Update payment status to SUCCESS
    if (order.payment) {
      await this.prisma.payment.update({
        where: { orderId: order.id },
        data: {
          status: PaymentStatus.SUCCESS,
          gatewayTransactionId: transactionId || `MOCK-${Date.now()}`,
          paidAt: new Date(),
          gatewayResponse: { mock: true, transactionId },
        },
      });
    } else {
      // Create payment record if it doesn't exist
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          paymentMethod: order.paymentMethod,
          status: PaymentStatus.SUCCESS,
          amount: order.totalAmount,
          currency: 'TND',
          gatewayTransactionId: transactionId || `MOCK-${Date.now()}`,
          paidAt: new Date(),
          gatewayResponse: { mock: true, transactionId },
        },
      });
    }

    // Update order status to CONFIRMED
    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'CONFIRMED' },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
        payment: true,
      },
    });

    this.logger.log(`Mock payment successful for order ${order.orderNumber}`);

    return updatedOrder;
  }
}

