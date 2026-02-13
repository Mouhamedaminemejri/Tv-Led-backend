import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

export interface KonnectInitiateResponse {
  success: boolean;
  paymentUrl?: string;
  paymentRef?: string;
  error?: string;
}

@Injectable()
export class KonnectService {
  private readonly logger = new Logger(KonnectService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly walletId: string;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl =
      this.configService.get<string>('KONNECT_API_URL') ||
      'https://api.konnect.network';
    this.apiKey = this.configService.get<string>('KONNECT_API_KEY') || '';
    this.walletId = this.configService.get<string>('KONNECT_WALLET_ID') || '';
    this.webhookSecret =
      this.configService.get<string>('KONNECT_WEBHOOK_SECRET') || '';
  }

  async initiatePayment(params: {
    amountTnd: number;
    orderNumber: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    successUrl: string;
    failUrl: string;
    callbackUrl: string;
  }): Promise<KonnectInitiateResponse> {
    try {
      if (!this.apiKey || !this.walletId) {
        this.logger.warn(
          'Konnect credentials not configured. Using mock payment URL for testing.',
        );
        const separator = params.successUrl.includes('?') ? '&' : '?';
        return {
          success: true,
          paymentUrl: `${params.successUrl}${separator}mock=true&gateway=konnect&transactionId=MOCK-KONNECT-${Date.now()}`,
          paymentRef: `MOCK-KONNECT-${Date.now()}`,
        };
      }

      const [firstName, ...rest] = params.fullName.trim().split(/\s+/g);
      const lastName = rest.join(' ') || firstName;
      const amountInMillimes = Math.round(params.amountTnd * 1000);

      const payload = {
        receiverWalletId: this.walletId,
        amount: amountInMillimes,
        token: 'TND',
        type: 'immediate',
        firstName: firstName || 'Customer',
        lastName: lastName || 'Customer',
        email: params.email,
        phoneNumber: params.phoneNumber,
        orderId: params.orderNumber,
        successUrl: params.successUrl,
        failUrl: params.failUrl,
        webhook: params.callbackUrl,
      };

      const response = await axios.post(
        `${this.apiUrl}/v2/payments/init-payment`,
        payload,
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      const data = response.data || {};
      const paymentUrl = data.payUrl || data.paymentUrl || data.url;
      const paymentRef = data.paymentRef || data.paymentRefId || data.id;

      if (!paymentUrl) {
        return {
          success: false,
          error: 'Konnect did not return a payment URL',
        };
      }

      return {
        success: true,
        paymentUrl,
        paymentRef: paymentRef ? String(paymentRef) : undefined,
      };
    } catch (error: any) {
      this.logger.error('Error initiating Konnect payment', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
      });
      return {
        success: false,
        error:
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          'Failed to initiate Konnect payment',
      };
    }
  }

  async verifyCallback(callbackData: any): Promise<{
    success: boolean;
    orderId?: string;
    transactionId?: string;
    status?: string;
  }> {
    try {
      // Konnect callback payload can vary by flow; normalize aggressively.
      const orderId =
        callbackData?.orderId ||
        callbackData?.orderNumber ||
        callbackData?.payment?.orderId ||
        callbackData?.payment?.orderNumber;

      const statusRaw =
        callbackData?.status ||
        callbackData?.paymentStatus ||
        callbackData?.payment?.status ||
        callbackData?.state;

      const transactionId =
        callbackData?.paymentRef ||
        callbackData?.id ||
        callbackData?.paymentId ||
        callbackData?.payment?.id;

      if (!orderId) {
        return { success: false };
      }

      return {
        success: true,
        orderId: String(orderId),
        transactionId: transactionId ? String(transactionId) : undefined,
        status: statusRaw ? String(statusRaw).toLowerCase() : 'unknown',
      };
    } catch (error) {
      this.logger.error('Error verifying Konnect callback', error);
      return { success: false };
    }
  }

  verifyWebhookSignature(callbackData: any, signature?: string): boolean {
    // If secret is not configured, we cannot validate signature.
    if (!this.webhookSecret) {
      this.logger.warn(
        'KONNECT_WEBHOOK_SECRET is not configured. Webhook signature validation is bypassed.',
      );
      return true;
    }

    if (!signature) {
      this.logger.warn('Webhook signature missing while secret is configured.');
      return false;
    }

    try {
      const payloadString = JSON.stringify(callbackData ?? {});
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payloadString)
        .digest('hex');

      const received = signature.startsWith('sha256=')
        ? signature.slice('sha256='.length)
        : signature;

      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(received, 'hex');
      if (expectedBuf.length !== receivedBuf.length) return false;

      return crypto.timingSafeEqual(expectedBuf, receivedBuf);
    } catch (error) {
      this.logger.error('Failed to validate Konnect webhook signature', error);
      return false;
    }
  }
}

