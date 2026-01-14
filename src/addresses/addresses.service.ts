import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaClient, Address, AddressType } from '@prisma/client';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(@Inject('PRISMA') private prisma: PrismaClient) {}

  /**
   * Get all addresses for a user
   */
  async getUserAddresses(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Get single address by ID (verify ownership)
   */
  async getAddressById(addressId: string, userId: string): Promise<Address> {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException(`Address with ID ${addressId} not found`);
    }

    if (address.userId !== userId) {
      throw new NotFoundException(`Address with ID ${addressId} not found`);
    }

    return address;
  }

  /**
   * Create new address
   */
  async createAddress(
    userId: string,
    createAddressDto: CreateAddressDto,
  ): Promise<Address> {
    // If setting as default, unset other defaults of the same type
    if (createAddressDto.isDefault) {
      await this.prisma.address.updateMany({
        where: {
          userId,
          type: createAddressDto.type,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        ...createAddressDto,
        userId,
        country: createAddressDto.country || 'Tunisia',
      },
    });
  }

  /**
   * Update address
   */
  async updateAddress(
    addressId: string,
    userId: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<Address> {
    // Verify ownership
    await this.getAddressById(addressId, userId);

    // If setting as default, unset other defaults of the same type
    if (updateAddressDto.isDefault !== undefined && updateAddressDto.isDefault) {
      const address = await this.prisma.address.findUnique({
        where: { id: addressId },
      });

      if (address) {
        await this.prisma.address.updateMany({
          where: {
            userId,
            type: updateAddressDto.type || address.type,
            isDefault: true,
            id: { not: addressId },
          },
          data: { isDefault: false },
        });
      }
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data: updateAddressDto,
    });
  }

  /**
   * Delete address
   */
  async deleteAddress(addressId: string, userId: string): Promise<void> {
    // Verify ownership
    await this.getAddressById(addressId, userId);

    await this.prisma.address.delete({
      where: { id: addressId },
    });
  }

  /**
   * Set address as default for a specific type
   */
  async setDefaultAddress(
    addressId: string,
    userId: string,
    type: AddressType,
  ): Promise<Address> {
    // Verify ownership
    await this.getAddressById(addressId, userId);

    // Unset other defaults of the same type
    await this.prisma.address.updateMany({
      where: {
        userId,
        type,
        isDefault: true,
        id: { not: addressId },
      },
      data: { isDefault: false },
    });

    // Set this address as default
    return this.prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true, type },
    });
  }
}
