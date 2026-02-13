import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient, OrderStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}

  async getOverview(lowStockThreshold: number = 5): Promise<{
    sales: {
      day: number;
      month: number;
      year: number;
    };
    orderVolume: {
      successfulDeliveries: number;
      pendingPickups: number;
    };
    inventoryHealth: {
      threshold: number;
      lowStockCount: number;
      lowStockProducts: Array<{
        id: string;
        title: string;
        reference: string;
        models: string | null;
        stock: number;
      }>;
    };
  }> {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [daySalesAgg, monthSalesAgg, yearSalesAgg, successfulDeliveries, pendingPickups, lowStockProducts] =
      await Promise.all([
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            status: OrderStatus.DELIVERED,
            createdAt: { gte: dayStart },
          },
        }),
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            status: OrderStatus.DELIVERED,
            createdAt: { gte: monthStart },
          },
        }),
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            status: OrderStatus.DELIVERED,
            createdAt: { gte: yearStart },
          },
        }),
        this.prisma.order.count({
          where: { status: OrderStatus.DELIVERED },
        }),
        this.prisma.order.count({
          where: { status: { in: [OrderStatus.PENDING, OrderStatus.PICKUP] } },
        }),
        this.prisma.product.findMany({
          where: { stock: { lte: lowStockThreshold } },
          select: {
            id: true,
            title: true,
            reference: true,
            models: true,
            stock: true,
          },
          orderBy: [{ stock: 'asc' }, { updatedAt: 'desc' }],
          take: 20,
        }),
      ]);

    return {
      sales: {
        day: daySalesAgg._sum.totalAmount ?? 0,
        month: monthSalesAgg._sum.totalAmount ?? 0,
        year: yearSalesAgg._sum.totalAmount ?? 0,
      },
      orderVolume: {
        successfulDeliveries,
        pendingPickups,
      },
      inventoryHealth: {
        threshold: lowStockThreshold,
        lowStockCount: lowStockProducts.length,
        lowStockProducts,
      },
    };
  }
}

