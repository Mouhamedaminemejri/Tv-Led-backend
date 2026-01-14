import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AddressType } from '@prisma/client';

@Controller('auth/addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  async getUserAddresses(@CurrentUser() user: { id: string }) {
    const addresses = await this.addressesService.getUserAddresses(user.id);
    return { addresses };
  }

  @Get(':id')
  async getAddress(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.addressesService.getAddressById(id, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAddress(
    @Body() createAddressDto: CreateAddressDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.addressesService.createAddress(user.id, createAddressDto);
  }

  @Put(':id')
  async updateAddress(
    @Param('id') id: string,
    @Body() updateAddressDto: UpdateAddressDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.addressesService.updateAddress(id, user.id, updateAddressDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAddress(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.addressesService.deleteAddress(id, user.id);
  }

  @Put(':id/default')
  async setDefaultAddress(
    @Param('id') id: string,
    @Body('type') type: AddressType,
    @CurrentUser() user: { id: string },
  ) {
    return this.addressesService.setDefaultAddress(id, user.id, type);
  }
}
