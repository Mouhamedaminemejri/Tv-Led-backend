import { Module, forwardRef } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CartModule } from '../cart/cart.module';
import { StorageModule } from '../storage/storage.module';
import { OcrService } from './services/ocr.service';

@Module({
  imports: [PrismaModule, forwardRef(() => CartModule), StorageModule],
  controllers: [ProductsController],
  providers: [ProductsService, OcrService],
  exports: [ProductsService],
})
export class ProductsModule { }
