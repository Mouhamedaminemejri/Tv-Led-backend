import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { Prisma, PrismaClient, Product } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { FilterDataDto } from './dto/filter-data.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ScanAndAddDto } from './dto/scan-and-add.dto';
import { QuickAddProductDto } from './dto/quick-add-product.dto';
import { CartService } from '../cart/cart.service';
import { StorageService } from '../storage/storage.service';
import { OcrService } from './services/ocr.service';
import { buildProductTitle } from './utils/build-product-title';
import { normalizeProductConfig } from './utils/normalize-product-config';

@Injectable()
export class ProductsService {
    constructor(
        @Inject('PRISMA') private prisma: PrismaClient,
        @Inject(forwardRef(() => CartService)) private cartService: CartService,
        private readonly storageService: StorageService,
        private readonly ocrService: OcrService,
    ) { }

    private normalizeLookupValue(value?: string | null): string | undefined {
        const normalized = value?.trim();
        return normalized ? normalized : undefined;
    }

    private async ensureBrandExists(brand: string): Promise<string> {
        const normalizedBrand = this.normalizeLookupValue(brand);
        if (!normalizedBrand) {
            throw new BadRequestException('brand is required');
        }

        await this.prisma.brand.upsert({
            where: { name: normalizedBrand },
            update: {},
            create: { name: normalizedBrand },
        });

        return normalizedBrand;
    }

    private async ensureSupplierExists(supplier?: string): Promise<string | undefined> {
        const normalizedSupplier = this.normalizeLookupValue(supplier);
        if (!normalizedSupplier) {
            return undefined;
        }

        await this.prisma.supplier.upsert({
            where: { name: normalizedSupplier },
            update: {},
            create: { name: normalizedSupplier },
        });

        return normalizedSupplier;
    }

    private resolvePositivePrice(price?: number, salePrice?: number): number {
        const resolved = price ?? salePrice;
        if (resolved === undefined || resolved <= 0) {
            throw new BadRequestException('price must be greater than 0');
        }
        return resolved;
    }

    private buildSearchTokens(query?: string): string[] {
        if (!query) return [];
        const cleaned = query.trim().toLowerCase();
        if (!cleaned) return [];

        return Array.from(
            new Set(
                cleaned
                    .split(/[\s,;|+/_\-]+/g)
                    .map((token) => this.normalizeTokenForSmartSearch(token))
                    .filter((token) => token.length >= 2),
            ),
        );
    }

    private normalizeTokenForSmartSearch(token: string): string {
        return token
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/(.)\1+/g, '$1')
            .replace(/[^a-z0-9]/g, '');
    }

    private normalizeTextForSmartSearch(text: string): string {
        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    private extractTvSizesFromTokens(tokens: string[]): number[] {
        const sizes = new Set<number>();
        for (const token of tokens) {
            const numberMatch = token.match(/(\d{2,3})/);
            if (!numberMatch) continue;
            const parsed = parseInt(numberMatch[1], 10);
            if (isNaN(parsed)) continue;

            // Consider numeric token as TV size intent when it looks like inches or TV token.
            if (
                token === numberMatch[1] ||
                token.includes('tv') ||
                token.includes('inch') ||
                token.includes('in')
            ) {
                sizes.add(parsed);
            }
        }
        return Array.from(sizes);
    }

    private levenshteinDistance(a: string, b: string): number {
        const m = a.length;
        const n = b.length;
        if (m === 0) return n;
        if (n === 0) return m;

        const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost,
                );
            }
        }

        return dp[m][n];
    }

    private fuzzyTokenMatchesWord(token: string, word: string): boolean {
        if (!token || !word) return false;
        const maxDistance = token.length >= 7 ? 2 : 1;
        return this.levenshteinDistance(token, word) <= maxDistance;
    }

    private buildTokenSearchOrConditions(token: string) {
        return [
            { title: { contains: token, mode: 'insensitive' as const } },
            { reference: { contains: token, mode: 'insensitive' as const } },
            { suk: { contains: token, mode: 'insensitive' as const } },
            { models: { contains: token, mode: 'insensitive' as const } },
            { tvBacklightType: { contains: token, mode: 'insensitive' as const } },
            { tvPanelType: { contains: token, mode: 'insensitive' as const } },
            { brand: { contains: token, mode: 'insensitive' as const } },
            { supplier: { contains: token, mode: 'insensitive' as const } },
            { tvFullName: { contains: token, mode: 'insensitive' as const } },
        ];
    }

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
            // New filters for advanced search
            modelName?: string;
            reference?: string;
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
        const andConditions: any[] = [];

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
                where.tvSizeInch = { in: sizeNumbers };
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

        // Specific Model Name search
        if (filters?.modelName) {
            where.models = {
                contains: filters.modelName.trim(),
                mode: 'insensitive',
            };
        }

        // Specific Reference search (matches SKU or Reference)
        if (filters?.reference) {
            andConditions.push({
                OR: [
                    { reference: { contains: filters.reference.trim(), mode: 'insensitive' } },
                    { suk: { contains: filters.reference.trim(), mode: 'insensitive' } },
                    { tvBacklightType: { contains: filters.reference.trim(), mode: 'insensitive' } },
                ]
            });
        }

        // Generic Search: tokenize and require each token to match at least one searchable field.
        if (filters?.search) {
            const searchTokens = this.buildSearchTokens(filters.search);
            const sizeTokens = this.extractTvSizesFromTokens(searchTokens);

            if (sizeTokens.length > 0) {
                andConditions.push({
                    tvSizeInch: { in: sizeTokens },
                });
            }

            for (const token of searchTokens) {
                andConditions.push({
                    OR: this.buildTokenSearchOrConditions(token),
                });
            }
        }

        if (andConditions.length > 0) {
            where.AND = andConditions;
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
    async findFilterData(): Promise<FilterDataDto[]> {
        const products = await this.prisma.product.findMany({
            select: {
                id: true,
                brand: true,
                tvSizeInch: true,
                price: true,
                stock: true,
                tags: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Keep API contract stable: `FilterDataDto` uses `size`, DB uses `tvSizeInch`.
        return products.map((p) => ({
            id: p.id,
            brand: p.brand,
            size: p.tvSizeInch,
            price: p.price.toNumber(),
            stock: p.stock,
            tags: p.tags,
        }));
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
        let normalizedConfig: string;
        try {
            normalizedConfig = normalizeProductConfig(createProductDto.config).configString;
        } catch {
            throw new BadRequestException('config must be a valid JSON object string');
        }

        const computedTitle = buildProductTitle({
            tvBacklightType: createProductDto.tvBacklightType,
            brand: createProductDto.brand,
            tvSizeInch: createProductDto.tvSizeInch,
            stripCount: createProductDto.stripCount,
            ledCount: createProductDto.ledCount,
            voltage: createProductDto.voltage,
            length: createProductDto.length,
        });

        const brand = await this.ensureBrandExists(createProductDto.brand);
        const supplier = await this.ensureSupplierExists(createProductDto.supplier);
        const price = this.resolvePositivePrice(createProductDto.price, createProductDto.salePrice);
        const tvFullName = createProductDto.tvFullName ?? createProductDto.adminReference;

        return this.prisma.product.create({
            data: {
                tvBacklightType: createProductDto.tvBacklightType,
                tvPanelType: createProductDto.tvPanelType,
                reference: createProductDto.reference,
                brand,
                tvFullName,
                title: computedTitle,
                purchasePrice: createProductDto.purchasePrice,
                supplier,
                config: normalizedConfig,
                salePrice: createProductDto.salePrice,
                price,
                tvSizeInch: createProductDto.tvSizeInch,
                stripCount: createProductDto.stripCount,
                ledCount: createProductDto.ledCount,
                voltage: createProductDto.voltage,
                length: createProductDto.length,
                stock: createProductDto.stock || 0,
                rating: createProductDto.rating || 0,
                images: createProductDto.images || [],
                tags: createProductDto.tags || [],
            },
        });
    }

    async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
        const product = await this.findOne(id);

        let normalizedConfig: string | undefined;

        if (updateProductDto.config !== undefined) {
            try {
                normalizedConfig = normalizeProductConfig(
                    updateProductDto.config,
                ).configString;
            } catch {
                throw new BadRequestException('config must be a valid JSON object string');
            }
        }

        const shouldRecomputeTitle = updateProductDto.title === undefined && (
            updateProductDto.tvBacklightType !== undefined ||
            updateProductDto.brand !== undefined ||
            updateProductDto.tvSizeInch !== undefined ||
            updateProductDto.stripCount !== undefined ||
            updateProductDto.ledCount !== undefined ||
            updateProductDto.voltage !== undefined ||
            updateProductDto.length !== undefined
        );

        const computedTitle = shouldRecomputeTitle
            ? buildProductTitle({
                tvBacklightType: updateProductDto.tvBacklightType ?? product.tvBacklightType,
                brand: updateProductDto.brand ?? product.brand,
                tvSizeInch: updateProductDto.tvSizeInch ?? product.tvSizeInch,
                stripCount: updateProductDto.stripCount ?? product.stripCount,
                ledCount: updateProductDto.ledCount ?? product.ledCount,
                voltage: updateProductDto.voltage ?? product.voltage,
                length: updateProductDto.length ?? product.length,
            })
            : undefined;

        const brand = updateProductDto.brand !== undefined
            ? await this.ensureBrandExists(updateProductDto.brand)
            : undefined;
        let supplier: string | null | undefined;
        if (updateProductDto.supplier !== undefined) {
            const normalizedSupplier = this.normalizeLookupValue(updateProductDto.supplier);
            if (normalizedSupplier) {
                supplier = await this.ensureSupplierExists(normalizedSupplier);
            } else {
                supplier = null;
            }
        }
        const tvFullName = updateProductDto.tvFullName ?? updateProductDto.adminReference;

        const updatedProduct = await this.prisma.product.update({
            where: { id },
            data: {
                ...(updateProductDto.tvBacklightType !== undefined && { tvBacklightType: updateProductDto.tvBacklightType }),
                ...(updateProductDto.tvPanelType !== undefined && { tvPanelType: updateProductDto.tvPanelType }),
                ...(updateProductDto.reference !== undefined && { reference: updateProductDto.reference }),
                ...(brand !== undefined && { brand }),
                ...((updateProductDto.tvFullName !== undefined || updateProductDto.adminReference !== undefined) && { tvFullName }),
                ...(updateProductDto.title !== undefined && { title: updateProductDto.title }),
                ...(computedTitle !== undefined && { title: computedTitle }),
                ...(updateProductDto.purchasePrice !== undefined && { purchasePrice: updateProductDto.purchasePrice }),
                ...(updateProductDto.supplier !== undefined && { supplier }),
                ...(normalizedConfig !== undefined && { config: normalizedConfig }),
                ...(updateProductDto.salePrice !== undefined && { salePrice: updateProductDto.salePrice }),
                ...(updateProductDto.price !== undefined && { price: updateProductDto.price }),
                ...(updateProductDto.tvSizeInch !== undefined && { tvSizeInch: updateProductDto.tvSizeInch }),
                ...(updateProductDto.stripCount !== undefined && { stripCount: updateProductDto.stripCount }),
                ...(updateProductDto.ledCount !== undefined && { ledCount: updateProductDto.ledCount }),
                ...(updateProductDto.voltage !== undefined && { voltage: updateProductDto.voltage }),
                ...(updateProductDto.length !== undefined && { length: updateProductDto.length }),
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
        const normalizedConfig = normalizeProductConfig(undefined).configString;
        const brand = await this.ensureBrandExists(dto.brand || 'Unknown');
        const supplier = await this.ensureSupplierExists(dto.supplier);
        const price = this.resolvePositivePrice(dto.price, dto.salePrice);
        const tvFullName = dto.tvFullName ?? dto.adminReference;
        const tvBacklightType = dto.tvBacklightType || tvFullName || 'Direct LED';

        const computedTitle = buildProductTitle({
            tvBacklightType,
            brand,
            tvSizeInch: dto.tvSizeInch,
            stripCount: dto.stripCount,
            ledCount: dto.ledCount,
            voltage: dto.voltage,
            length: dto.length,
        });

        // Create product with all provided fields
        return this.prisma.product.create({
            data: {
                reference: dto.reference,
                brand,
                title: computedTitle,
                tvBacklightType,
                tvFullName,
                purchasePrice: dto.purchasePrice,
                supplier,
                config: normalizedConfig,
                salePrice: dto.salePrice,
                price,
                tvSizeInch: dto.tvSizeInch,
                stripCount: dto.stripCount,
                ledCount: dto.ledCount,
                voltage: dto.voltage,
                length: dto.length,
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

        // Non-admin flow: config is always initialized with empty/static keys.
        const normalizedConfig = normalizeProductConfig(undefined).configString;
        const brand = await this.ensureBrandExists(metadata?.brand || 'Unknown');
        const supplier = await this.ensureSupplierExists(metadata?.supplier);
        const price = this.resolvePositivePrice(metadata?.price, metadata?.salePrice);
        const tvFullName = metadata?.tvFullName ?? metadata?.adminReference;
        const tvBacklightType = metadata?.tvBacklightType || tvFullName || 'Direct LED';

        // Step 5: Prepare product data
        const computedTitle = buildProductTitle({
            tvBacklightType,
            brand,
            tvSizeInch: metadata?.tvSizeInch,
            stripCount: metadata?.stripCount,
            ledCount: metadata?.ledCount,
            voltage: metadata?.voltage,
            length: metadata?.length,
        });

        const productData: Prisma.ProductUncheckedCreateInput = {
            reference,
            brand,
            title: computedTitle,
            tvBacklightType,
            tvFullName,
            purchasePrice: metadata?.purchasePrice,
            supplier,
            config: normalizedConfig,
            salePrice: metadata?.salePrice,
            price,
            tvSizeInch: metadata?.tvSizeInch,
            stripCount: metadata?.stripCount,
            ledCount: metadata?.ledCount,
            voltage: metadata?.voltage,
            length: metadata?.length,
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
        models: string[];
        tvPanelTypes: string[];
        suks: string[];
        products: Array<{
            id: string;
            title: string;
            reference: string;
            brand: string;
            price: number;
            salePrice: number | null;
            stock: number;
            tvSizeInch: number | null;
            image: string | null;
            matchedBy: string[];
        }>;
    }> {
        // Minimum query length check (handled in controller, but double-check here)
        if (!query || query.trim().length < 2) {
            return {
                brands: [],
                references: [],
                titles: [],
                models: [],
                tvPanelTypes: [],
                suks: [],
                products: [],
            };
        }

        const searchTerm = query.trim();
        const tokens = this.buildSearchTokens(searchTerm);
        const sizeTokens = this.extractTvSizesFromTokens(tokens);
        const searchLimit = Math.min(limit, 20); // Max 20 per category
        const broadTokens = Array.from(
            new Set(
                tokens.flatMap((t) => (t.length >= 5 ? [t, t.slice(0, -1)] : [t])),
            ),
        );
        const broadOrConditions: any[] = [];
        for (const token of broadTokens) {
            broadOrConditions.push(...this.buildTokenSearchOrConditions(token));
        }
        if (sizeTokens.length > 0) {
            broadOrConditions.push({ tvSizeInch: { in: sizeTokens } });
        }

        const candidates = await this.prisma.product.findMany({
            where: broadOrConditions.length > 0 ? { OR: broadOrConditions } : undefined,
            select: {
                id: true,
                title: true,
                reference: true,
                brand: true,
                price: true,
                salePrice: true,
                stock: true,
                tvSizeInch: true,
                images: true,
                models: true,
                tvBacklightType: true,
                tvPanelType: true,
                supplier: true,
                suk: true,
                createdAt: true,
            },
            take: 250,
            orderBy: [
                { stock: 'desc' },
                { createdAt: 'desc' },
            ],
        });

        const matchedProducts = candidates
            .map((p) => {
                const fields = [
                    { key: 'title', value: p.title || '' },
                    { key: 'reference', value: p.reference || '' },
                    { key: 'brand', value: p.brand || '' },
                    { key: 'models', value: p.models || '' },
                    { key: 'tvBacklightType', value: p.tvBacklightType || '' },
                    { key: 'tvPanelType', value: p.tvPanelType || '' },
                    { key: 'supplier', value: p.supplier || '' },
                    { key: 'suk', value: p.suk || '' },
                ].map((f) => ({
                    key: f.key,
                    normalized: this.normalizeTextForSmartSearch(f.value),
                    words: this.normalizeTextForSmartSearch(f.value).split(/\s+/g).filter(Boolean),
                }));

                const matchedBy = new Set<string>();
                let score = 0;

                if (sizeTokens.length > 0 && p.tvSizeInch && sizeTokens.includes(p.tvSizeInch)) {
                    matchedBy.add('tvSizeInch');
                    score += 3;
                }

                for (const token of tokens) {
                    let tokenMatched = false;
                    for (const f of fields) {
                        if (!f.normalized) continue;
                        if (f.normalized.includes(token)) {
                            matchedBy.add(f.key);
                            score += 3;
                            tokenMatched = true;
                            break;
                        }

                        for (const w of f.words) {
                            if (this.fuzzyTokenMatchesWord(token, w)) {
                                matchedBy.add(f.key);
                                score += 1;
                                tokenMatched = true;
                                break;
                            }
                        }
                        if (tokenMatched) break;
                    }

                    if (!tokenMatched) {
                        score -= 2;
                    }
                }

                return { product: p, matchedBy, score };
            })
            .filter((entry) => entry.score > 0)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.product.stock !== a.product.stock) return b.product.stock - a.product.stock;
                return b.product.createdAt.getTime() - a.product.createdAt.getTime();
            })
            .slice(0, searchLimit);

        const brandsSet = new Set<string>();
        const referencesSet = new Set<string>();
        const titlesSet = new Set<string>();
        const panelTypesSet = new Set<string>();
        const suksSet = new Set<string>();
        const modelsSet = new Set<string>();

        for (const entry of matchedProducts) {
            brandsSet.add(entry.product.brand);
            referencesSet.add(entry.product.reference);
            titlesSet.add(entry.product.title);
            if (entry.product.tvPanelType) panelTypesSet.add(entry.product.tvPanelType);
            if (entry.product.suk) suksSet.add(entry.product.suk);

            const rawModels = entry.product.models || '';
            if (rawModels) {
                const parts = rawModels
                    .replace(/and\s+others\.?/gi, '')
                    .split(/[,;\n\r]+/g)
                    .map((part) => part.trim())
                    .filter(Boolean);
                for (const part of parts) {
                    if (modelsSet.size < searchLimit) modelsSet.add(part);
                }
            }
        }

        return {
            brands: Array.from(brandsSet).slice(0, searchLimit),
            references: Array.from(referencesSet).slice(0, searchLimit),
            titles: Array.from(titlesSet).slice(0, searchLimit),
            models: Array.from(modelsSet),
            tvPanelTypes: Array.from(panelTypesSet).slice(0, searchLimit),
            suks: Array.from(suksSet).slice(0, searchLimit),
            products: matchedProducts.map((entry) => {
                const p = entry.product;
                return {
                    id: p.id,
                    title: p.title,
                    reference: p.reference,
                    brand: p.brand,
                    price: p.price.toNumber(),
                    salePrice: p.salePrice ? p.salePrice.toNumber() : null,
                    stock: p.stock,
                    tvSizeInch: p.tvSizeInch,
                    image: p.images[0] || null,
                    matchedBy: Array.from(entry.matchedBy),
                };
            }),
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
