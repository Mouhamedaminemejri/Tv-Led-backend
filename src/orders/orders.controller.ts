import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderStatus } from '@prisma/client';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(@Body() createOrderDto: CreateOrderDto): Promise<Order> {
    return this.ordersService.createOrder(createOrderDto);
  }

  @Get()
  async getUserOrders(@Query('userId') userId: string): Promise<Order[]> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.ordersService.getUserOrders(userId);
  }

  @Get(':id')
  async getOrder(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<Order> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.ordersService.getOrder(id, userId);
  }

  @Put(':id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
  ): Promise<Order> {
    if (!status) {
      throw new BadRequestException('status is required');
    }
    return this.ordersService.updateOrderStatus(id, status);
  }
}


