import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderStatus, PickupMethod } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: { id: string },
  ): Promise<Order> {
    return this.ordersService.createOrder({
      ...createOrderDto,
      userId: user.id,
    });
  }

  @Get()
  async getUserOrders(@CurrentUser() user: { id: string }): Promise<Order[]> {
    return this.ordersService.getUserOrders(user.id);
  }

  /**
   * Get user orders with pagination (User's own orders)
   * GET /api/orders/my-orders
   */
  @Get('my-orders')
  async getMyOrders(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: OrderStatus,
  ): Promise<{
    data: Order[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.ordersService.getUserOrdersPaginated(
      user.id,
      pageNum,
      limitNum,
      status,
    );
  }

  /**
   * Get single order by ID (User's own order)
   * GET /api/orders/my-orders/:id
   */
  @Get('my-orders/:id')
  async getMyOrder(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<Order> {
    return this.ordersService.getOrder(id, user.id, null);
  }

  @Get(':id')
  async getOrder(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<Order> {
    return this.ordersService.getOrder(id, user.id, null);
  }

  /**
   * Get all orders (Admin only)
   * GET /api/orders/admin/all
   * Query params: page, limit, status, userId, clientName, email, phoneNumber
   */
  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: OrderStatus,
    @Query('userId') userId?: string,
    @Query('clientName') clientName?: string,
    @Query('email') email?: string,
    @Query('phoneNumber') phoneNumber?: string,
  ): Promise<{
    data: Order[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.ordersService.getAllOrders(
      pageNum,
      limitNum,
      status,
      userId,
      clientName,
      email,
      phoneNumber,
    );
  }

  /**
   * Get orders by user ID (Admin only)
   * GET /api/orders/admin/user/:userId
   */
  @Get('admin/user/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getOrdersByUser(@Param('userId') userId: string): Promise<Order[]> {
    return this.ordersService.getUserOrders(userId);
  }

  /**
   * Get order workflow options (Admin only)
   * GET /api/orders/admin/status-options
   */
  @Get('admin/status-options')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  getOrderStatusOptions() {
    return this.ordersService.getOrderStatusOptions();
  }

  /**
   * Get single order by ID (Admin only - can access any order)
   * GET /api/orders/admin/:id
   */
  @Get('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getOrderAdmin(@Param('id') id: string): Promise<Order> {
    return this.ordersService.getOrderById(id);
  }

  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateOrderStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
    @Body('pickupMethod') pickupMethod?: PickupMethod,
  ): Promise<Order> {
    if (!status) {
      throw new BadRequestException('status is required');
    }
    return this.ordersService.updateOrderStatus(id, status, pickupMethod);
  }
}


