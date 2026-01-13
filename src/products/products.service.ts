import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaClient, Product } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ScanAndAddDto } from './dto/scan-and-add.dto';
import { QuickAddProductDto } from './dto/quick-add-product.dto';
import { CartService } from '../cart/cart.service';
import { StorageService } from '../storage/storage.service';
import { OcrService } from './services/ocr.service';

@Injectable()
export class ProductsService {
    constructor(
        @Inject('PRISMA') private prisma: PrismaClient,
        @Inject(forwardRef(() => CartService)) private cartService: CartService,
        private readonly storageService: StorageService,
        private readonly ocrService: OcrService,
    ) { }

    async findAll(): Promise<Product[]> {
        return this.prisma.product.findMany();
    }

    /**
     * Get paginated products with optional filtering
     * All filters are combined with AND logic
     * Pagination happens AFTER filtering
     */
    async findPaginated(
        page: number = 1,
        limit: number = 10,
        filters?: {
            brands?: string[];
            sizes?: string[]; // Accepts strings (e.g., "32", "43", "55") and converts to numbers
            minPrice?: number;
            maxPrice?: number;
            inStock?: boolean;
            search?: string;
        },
    ): Promise<{
        data: Product[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const skip = (page - 1) * limit;

        // Build Prisma where clause (all filters combined with AND)
        const where: any = {};

        // Brand filter: case-insensitive matching
        if (filters?.brands && filters.brands.length > 0) {
            where.brand = {
                in: filters.brands.map(b => b.trim()),
            };
        }

        // Size filter: handle sizes as strings (e.g., "32", "43", "55")
        if (filters?.sizes && filters.sizes.length > 0) {
            // Convert string sizes to numbers, filtering out invalid values
            const sizeNumbers = filters.sizes
                .map(s => {
                    const num = parseInt(s.trim(), 10);
                    return isNaN(num) ? null : num;
                })
                .filter((n): n is number => n !== null);

            if (sizeNumbers.length > 0) {
                where.size = { in: sizeNumbers };
            }
        }

        // Price range filter
        if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
            where.price = {};
            if (filters.minPrice !== undefined) {
                where.price.gte = filters.minPrice;
            }
            if (filters.maxPrice !== undefined) {
                where.price.lte = filters.maxPrice;
            }
        }

        // Stock filter
        if (filters?.inStock !== undefined) {
            if (filters.inStock === true) {
                where.stock = { gt: 0 };
            } else if (filters.inStock === false) {
                where.stock = { equals: 0 };
            }
        }

        // Search filter: search in title and reference (case-insensitive)
        if (filters?.search) {
            where.OR = [
                { title: { contains: filters.search.trim(), mode: 'insensitive' } },
                { reference: { contains: filters.search.trim(), mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: 'desc', // Most recent first
                },
            }),
            this.prisma.product.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            data,
            total,
            page,
            limit,
            totalPages,
        };
    }

    /**
     * Get lightweight product data for crossfilter initialization
     * Returns only fields needed for filtering (no images, descriptions, etc.)
     * Used to calculate accurate facet counts across the entire catalog
     */
    async findFilterData(): Promise<Array<{
        id: string;
        brand: string;
        size: number | null;
        price: number;
        stock: number;
        tags: string[];
    }>> {
        return this.prisma.product.findMany({
            select: {
                id: true,
                brand: true,
                size: true,
                price: true,
                stock: true,
                tags: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findOne(id: string): Promise<Product> {
        const product = await this.prisma.product.findUnique({
            where: { id }
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${id} not found`);
        }

        return product;
    }

    async create(createProductDto: CreateProductDto): Promise<Product> {
        return this.prisma.product.create({
            data: {
                number: createProductDto.number,
                reference: createProductDto.reference,
                brand: createProductDto.brand,
                title: createProductDto.title,
                summary: createProductDto.summary,
                purchasePrice: createProductDto.purchasePrice,
                supplier: createProductDto.supplier,
                salePrice: createProductDto.salePrice,
                price: createProductDto.price,
                description: createProductDto.description,
                size: createProductDto.size,
                stock: createProductDto.stock || 0,
                rating: createProductDto.rating || 0,
                images: createProductDto.images || [],
                tags: createProductDto.tags || [],
            },
        });
    }

    async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
        const product = await this.findOne(id);

        const updatedProduct = await this.prisma.product.update({
            where: { id },
            data: {
                ...(updateProductDto.number !== undefined && { number: updateProductDto.number }),
                ...(updateProductDto.reference !== undefined && { reference: updateProductDto.reference }),
                ...(updateProductDto.brand !== undefined && { brand: updateProductDto.brand }),
                ...(updateProductDto.title !== undefined && { title: updateProductDto.title }),
                ...(updateProductDto.summary !== undefined && { summary: updateProductDto.summary }),
                ...(updateProductDto.purchasePrice !== undefined && { purchasePrice: updateProductDto.purchasePrice }),
                ...(updateProductDto.supplier !== undefined && { supplier: updateProductDto.supplier }),
                ...(updateProductDto.salePrice !== undefined && { salePrice: updateProductDto.salePrice }),
                ...(updateProductDto.price !== undefined && { price: updateProductDto.price }),
                ...(updateProductDto.description !== undefined && { description: updateProductDto.description }),
                ...(updateProductDto.size !== undefined && { size: updateProductDto.size }),
                ...(updateProductDto.stock !== undefined && { stock: updateProductDto.stock }),
                ...(updateProductDto.rating !== undefined && { rating: updateProductDto.rating }),
                ...(updateProductDto.images !== undefined && { images: updateProductDto.images }),
                ...(updateProductDto.tags !== undefined && { tags: updateProductDto.tags }),
            },
        });

        // Sync carts when product is updated
        await this.cartService.syncCartOnProductUpdate(id);

        return updatedProduct;
    }

    async remove(id: string): Promise<void> {
        const product = await this.findOne(id);
        
        // Sync carts before deleting product
        await this.cartService.syncCartOnProductDelete(id);
        
        await this.prisma.product.delete({
            where: { id },
        });
    }

    async removeMany(ids: string[]): Promise<{ deletedCount: number; failedIds: string[] }> {
        let deletedCount = 0;
        const failedIds: string[] = [];

        for (const id of ids) {
            try {
                // Check if product exists
                const product = await this.prisma.product.findUnique({
                    where: { id },
                });

                if (!product) {
                    failedIds.push(id);
                    continue;
                }

                // Sync carts before deleting product
                await this.cartService.syncCartOnProductDelete(id);
                
                await this.prisma.product.delete({
                    where: { id },
                });
                
                deletedCount++;
            } catch (error) {
                failedIds.push(id);
            }
        }

        return { deletedCount, failedIds };
    }

    /**
     * Quick add product - simplified version for mobile scanner
     * Checks for duplicates and creates product with minimal data
     */
    async quickAdd(dto: QuickAddProductDto): Promise<Product> {
        // Check if product with this reference already exists
        const existing = await this.prisma.product.findFirst({
            where: { reference: dto.reference },
        });

        if (existing) {
            throw new ConflictException(
                `Product with reference "${dto.reference}" already exists`,
            );
        }

        // Create product with all provided fields
        return this.prisma.product.create({
            data: {
                reference: dto.reference,
                brand: dto.brand || 'Unknown',
                title: dto.title || `LED strip - ${dto.reference}`,
                number: dto.number || dto.adminReference || undefined,
                description: dto.description,
                summary: dto.summary,
                purchasePrice: dto.purchasePrice,
                supplier: dto.supplier,
                salePrice: dto.salePrice,
                price: dto.price || dto.salePrice || 0,
                size: dto.size,
                stock: dto.stock ?? 0,
                rating: dto.rating ?? 0,
                images: [],
                tags: dto.tags || [],
            },
        });
    }

    /**
     * Scan image, extract reference code, save image, and create product
     * Fast OCR extraction (target: 3-4 seconds)
     */
    async scanAndAdd(
        imageFile: Express.Multer.File,
        metadata?: ScanAndAddDto,
        additionalImages: Express.Multer.File[] = [],
    ): Promise<{
        product: Product;
        reference: string;
        imageUrl: string;
        extractionTime: number;
    }> {
        const startTime = Date.now();

        // Step 1: Extract reference code using fast OCR (or use provided reference)
        let reference: string | undefined = metadata?.reference?.trim() || undefined;
        
        if (!reference && imageFile) {
            const extractedReference = await this.ocrService.extractReferenceCode(imageFile.buffer);
            reference = extractedReference || undefined;
        }

        if (!reference) {
            throw new BadRequestException(
                'Could not extract reference code from image. Please provide reference code manually.',
            );
        }

        // Step 2: Check if product already exists
        const existing = await this.prisma.product.findFirst({
            where: { reference },
        });

        // Step 3: Upload main image
        let imageUrl = '';
        if (imageFile) {
            const imagePath = await this.storageService.uploadFile(
                imageFile,
                'led-strips',
            );
            imageUrl = this.storageService.getFileUrl(imagePath);
        }

        // Step 4: Upload additional images
        const additionalImageUrls: string[] = [];
        for (const file of additionalImages) {
            const imagePath = await this.storageService.uploadFile(
                file,
                'led-strips',
            );
            additionalImageUrls.push(this.storageService.getFileUrl(imagePath));
        }

        // Step 5: Prepare product data
        const productData: any = {
            reference,
            brand: metadata?.brand || 'Unknown',
            title: metadata?.title || `LED strip - ${reference}`,
            number: metadata?.number || metadata?.adminReference || undefined,
            description: metadata?.description,
            summary: metadata?.summary,
            purchasePrice: metadata?.purchasePrice,
            supplier: metadata?.supplier,
            salePrice: metadata?.salePrice,
            price: metadata?.price || metadata?.salePrice || 0,
            size: metadata?.size,
            stock: metadata?.stock ?? 0,
            rating: metadata?.rating ?? 0,
            tags: metadata?.tags || [],
            images: imageUrl ? [imageUrl, ...additionalImageUrls] : additionalImageUrls,
        };

        if (existing) {
            // Update existing product
            const currentImages = Array.isArray(existing.images) ? existing.images : [];
            const updatedProduct = await this.prisma.product.update({
                where: { id: existing.id },
                data: {
                    ...productData,
                    images: [...currentImages, ...(imageUrl ? [imageUrl] : []), ...additionalImageUrls],
                },
            });

            const extractionTime = Date.now() - startTime;
            return {
                product: updatedProduct,
                reference,
                imageUrl: imageUrl || additionalImageUrls[0] || '',
                extractionTime,
            };
        }

        // Step 6: Create new product
        const product = await this.prisma.product.create({
            data: productData,
        });

        const extractionTime = Date.now() - startTime;

        return {
            product,
            reference,
            imageUrl: imageUrl || additionalImageUrls[0] || '',
            extractionTime,
        };
    }

    /**
     * Get search suggestions for autocomplete
     * Returns brands, references, and titles that match the search query
     */
    async getSearchSuggestions(
        query: string,
        limit: number = 5,
    ): Promise<{
        brands: string[];
        references: string[];
        titles: string[];
    }> {
        // Minimum query length check (handled in controller, but double-check here)
        if (!query || query.trim().length < 2) {
            return {
                brands: [],
                references: [],
                titles: [],
            };
        }

        const searchTerm = query.trim();
        const searchLimit = Math.min(limit, 20); // Max 20 per category

        // Get unique brands that match the search query
        const brands = await this.prisma.product.findMany({
            where: {
                brand: {
                    contains: searchTerm,
                    mode: 'insensitive',
                },
            },
            select: {
                brand: true,
            },
            distinct: ['brand'],
            take: searchLimit,
            orderBy: {
                brand: 'asc',
            },
        });

        // Get references that match the search query
        const references = await this.prisma.product.findMany({
            where: {
                reference: {
                    contains: searchTerm,
                    mode: 'insensitive',
                },
            },
            select: {
                reference: true,
            },
            distinct: ['reference'],
            take: searchLimit,
            orderBy: {
                reference: 'asc',
            },
        });

        // Get titles that match the search query
        const titles = await this.prisma.product.findMany({
            where: {
                OR: [
                    {
                        title: {
                            contains: searchTerm,
                            mode: 'insensitive',
                        },
                    },
                    {
                        reference: {
                            contains: searchTerm,
                            mode: 'insensitive',
                        },
                    },
                ],
            },
            select: {
                title: true,
            },
            take: searchLimit,
            orderBy: {
                createdAt: 'desc',
            },
        });

        return {
            brands: brands.map((p) => p.brand),
            references: references.map((p) => p.reference),
            titles: titles.map((p) => p.title),
        };
    }

    /**
     * Get all unique brands from products
     */
    async findAllBrands(): Promise<string[]> {
        const products = await this.prisma.product.findMany({
            select: {
                brand: true,
            },
            distinct: ['brand'],
            orderBy: {
                brand: 'asc',
            },
        });

        return products.map((p) => p.brand);
    }
}
