import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersModule } from '../orders/orders.module';
import { PaykassmaService } from './services/paykassma.service';
import { KonnectService } from './services/konnect.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, OrdersModule, AuthModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, PaykassmaService, KonnectService],
  exports: [CheckoutService],
})
export class CheckoutModule {}


