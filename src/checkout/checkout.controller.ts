import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GuestSession } from '../auth/decorators/guest-session.decorator';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('initiate-payment')
  @UseGuards(OptionalAuthGuard)
  async initiatePayment(
    @Body() initiatePaymentDto: InitiatePaymentDto,
    @CurrentUser() user: { id: string } | null,
    @GuestSession() guestSessionId: string | null,
  ) {
    if (!user && !guestSessionId) {
      throw new BadRequestException(
        'Authentication required. Please provide JWT token or X-Guest-Token header.',
      );
    }

    return this.checkoutService.initiatePayment(
      initiatePaymentDto,
      user?.id || null,
      guestSessionId || null,
    );
  }

  @Post('payment/callback')
  @Public()
  async handlePaymentCallback(
    @Body() callbackData: any,
    @Query('gateway') gateway: 'paykassma' | 'mobile' = 'paykassma',
  ) {
    return this.checkoutService.handlePaymentCallback(callbackData, gateway);
  }

  @Get('payment/status')
  @UseGuards(OptionalAuthGuard)
  async getPaymentStatus(
    @Query('orderId') orderId: string,
    @CurrentUser() user: { id: string } | null,
    @GuestSession() guestSessionId: string | null,
  ) {
    if (!orderId) {
      throw new BadRequestException('orderId is required');
    }
    return this.checkoutService.getPaymentStatus(
      orderId,
      user?.id || null,
      guestSessionId || null,
    );
  }

  @Get('success')
  @Public()
  async paymentSuccess(
    @Query('orderId') orderId: string,
    @Query('mock') mock?: string,
    @Query('transactionId') transactionId?: string,
  ) {
    // Handle mock payment success
    if (mock === 'true' && orderId) {
      // For mock payments, automatically confirm the order
      try {
        const order = await this.checkoutService.handleMockPaymentSuccess(
          orderId,
          transactionId,
        );
        return {
          success: true,
          message: 'Payment successful (Mock)',
          order,
        };
      } catch (error) {
        return {
          success: false,
          message: 'Failed to process mock payment',
          error: error.message,
        };
      }
    }

    // For real payments, return success page data
    return {
      success: true,
      message: 'Payment successful',
      orderId,
    };
  }
}

