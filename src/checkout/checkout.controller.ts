import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('initiate-payment')
  async initiatePayment(@Body() initiatePaymentDto: InitiatePaymentDto) {
    return this.checkoutService.initiatePayment(initiatePaymentDto);
  }

  @Post('payment/callback')
  async handlePaymentCallback(
    @Body() callbackData: any,
    @Query('gateway') gateway: 'paykassma' | 'mobile' = 'paykassma',
  ) {
    return this.checkoutService.handlePaymentCallback(callbackData, gateway);
  }

  @Get('payment/status')
  async getPaymentStatus(
    @Query('orderId') orderId: string,
    @Query('userId') userId: string,
  ) {
    if (!orderId || !userId) {
      throw new BadRequestException('orderId and userId are required');
    }
    return this.checkoutService.getPaymentStatus(orderId, userId);
  }

  @Get('success')
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

