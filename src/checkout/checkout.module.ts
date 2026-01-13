import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersModule } from '../orders/orders.module';
import { PaykassmaService } from './services/paykassma.service';

@Module({
  imports: [PrismaModule, OrdersModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, PaykassmaService],
  exports: [CheckoutService],
})
export class CheckoutModule {}


