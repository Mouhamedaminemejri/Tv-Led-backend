import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PaykassmaInitiateResponse {
  success: boolean;
  paymentUrl?: string;
  transactionId?: string;
  error?: string;
}

@Injectable()
export class PaykassmaService {
  private readonly logger = new Logger(PaykassmaService.name);
  private readonly apiUrl: string;
  private readonly merchantId: string;
  private readonly secretKey: string;
  private readonly isTestMode: boolean;

  constructor(private configService: ConfigService) {
    this.apiUrl =
      this.configService.get<string>('PAYKASSMA_API_URL') ||
      'https://api.paykassma.com';
    this.merchantId =
      this.configService.get<string>('PAYKASSMA_MERCHANT_ID') || '';
    this.secretKey =
      this.configService.get<string>('PAYKASSMA_SECRET_KEY') || '';
    this.isTestMode =
      this.configService.get<string>('PAYKASSMA_TEST_MODE') === 'true';
  }

  /**
   * Initiate payment with Paykassma
   */
  async initiatePayment(
    amount: number,
    orderNumber: string,
    customerEmail: string,
    customerName: string,
    callbackUrl: string,
    returnUrl: string,
  ): Promise<PaykassmaInitiateResponse> {
    try {
      // Check if credentials are configured
      if (!this.merchantId || !this.secretKey) {
        this.logger.warn(
          'Paykassma credentials not configured. Using mock payment URL for testing.',
        );
        // Return a mock payment URL for testing when credentials are not set
        // Properly format URL with query parameters
        const separator = returnUrl.includes('?') ? '&' : '?';
        return {
          success: true,
          paymentUrl: `${returnUrl}${separator}mock=true&transactionId=MOCK-${Date.now()}`,
          transactionId: `MOCK-${Date.now()}`,
        };
      }

      // Prepare payment request
      const paymentData: any = {
        merchant_id: this.merchantId,
        amount: amount.toFixed(2),
        currency: 'TND',
        order_id: orderNumber,
        order_description: `Order ${orderNumber}`,
        customer_email: customerEmail,
        customer_name: customerName,
        callback_url: callbackUrl,
        return_url: returnUrl,
        test_mode: this.isTestMode ? '1' : '0',
      };

      // Generate signature (HMAC SHA256)
      const signature = this.generateSignature(paymentData);
      paymentData.signature = signature;

      this.logger.log(`Initiating Paykassma payment for order ${orderNumber}`);

      // Make API request to Paykassma
      const response = await axios.post(
        `${this.apiUrl}/api/v1/payment/initiate`,
        paymentData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        },
      );

      this.logger.log('Paykassma API response', {
        status: response.status,
        data: response.data,
      });

      if (response.data.success || response.data.payment_url) {
        return {
          success: true,
          paymentUrl: response.data.payment_url || response.data.paymentUrl,
          transactionId:
            response.data.transaction_id || response.data.transactionId,
        };
      } else {
        this.logger.error('Paykassma payment initiation failed', response.data);
        return {
          success: false,
          error: response.data.error || response.data.message || 'Payment initiation failed',
        };
      }
    } catch (error: any) {
      this.logger.error('Error initiating Paykassma payment', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      // Return error details instead of throwing
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to initiate payment. Please try again.',
      };
    }
  }

  /**
   * Verify payment callback from Paykassma
   */
  async verifyCallback(data: any): Promise<{
    success: boolean;
    transactionId?: string;
    orderId?: string;
    amount?: number;
    status?: string;
  }> {
    try {
      // Verify signature
      const receivedSignature = data.signature;
      const calculatedSignature = this.generateSignature(data);

      if (receivedSignature !== calculatedSignature) {
        this.logger.warn('Invalid signature in Paykassma callback');
        return { success: false };
      }

      return {
        success: true,
        transactionId: data.transaction_id,
        orderId: data.order_id,
        amount: parseFloat(data.amount),
        status: data.status,
      };
    } catch (error) {
      this.logger.error('Error verifying Paykassma callback', error);
      return { success: false };
    }
  }

  /**
   * Generate HMAC SHA256 signature for Paykassma
   */
  private generateSignature(data: any): string {
    const crypto = require('crypto');
    // Sort keys and create query string
    const sortedKeys = Object.keys(data)
      .filter((key) => key !== 'signature')
      .sort();
    const queryString = sortedKeys
      .map((key) => `${key}=${data[key]}`)
      .join('&');

    // Generate HMAC SHA256
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(queryString)
      .digest('hex');
  }
}

