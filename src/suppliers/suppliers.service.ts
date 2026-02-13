import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient, Supplier } from '@prisma/client';

@Injectable()
export class SuppliersService {
  constructor(@Inject('PRISMA') private prisma: PrismaClient) {}

  async findAll(query?: string): Promise<Supplier[]> {
    const q = query?.trim();
    return this.prisma.supplier.findMany({
      where: q
        ? {
            name: {
              contains: q,
              mode: 'insensitive',
            },
          }
        : undefined,
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  async create(name: string): Promise<Supplier> {
    const normalized = name.trim();
    if (!normalized) {
      throw new BadRequestException('name is required');
    }

    try {
      return await this.prisma.supplier.create({
        data: { name: normalized },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`Supplier "${normalized}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, name?: string): Promise<Supplier> {
    await this.findOne(id);

    if (name === undefined) {
      return this.findOne(id);
    }

    const normalized = name.trim();
    if (!normalized) {
      throw new BadRequestException('name cannot be empty');
    }

    try {
      return await this.prisma.supplier.update({
        where: { id },
        data: { name: normalized },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`Supplier "${normalized}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.supplier.delete({
      where: { id },
    });
  }
}

