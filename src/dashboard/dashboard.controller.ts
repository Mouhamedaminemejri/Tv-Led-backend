import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(@Query('lowStockThreshold') lowStockThreshold?: string) {
    const thresholdNum = lowStockThreshold ? parseInt(lowStockThreshold, 10) : 5;
    const threshold = Number.isNaN(thresholdNum) ? 5 : Math.max(thresholdNum, 0);
    return this.dashboardService.getOverview(threshold);
  }
}

