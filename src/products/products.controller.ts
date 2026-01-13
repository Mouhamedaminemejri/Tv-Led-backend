import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, HttpStatus, Query, BadRequestException, UseInterceptors, UploadedFile, UploadedFiles, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { Product } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginatedResponseDto } from './dto/paginated-response.dto';
import { FilterDataDto } from './dto/filter-data.dto';
import { ProductsQueryDto } from './dto/products-query.dto';
import { SearchSuggestionsQueryDto } from './dto/search-suggestions-query.dto';
import { SearchSuggestionsResponseDto } from './dto/search-suggestions-response.dto';
import { QuickAddProductDto } from './dto/quick-add-product.dto';
import { ScanAndAddDto } from './dto/scan-and-add.dto';
import { BulkDeleteProductsDto } from './dto/bulk-delete-products.dto';

@Controller('products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    /**
     * Get paginated products with optional filtering
     * Query params: 
     *   - page (default: 1)
     *   - limit (default: 10, max: 100)
     *   - brands (comma-separated, e.g., "LG,Samsung")
     *   - sizes (comma-separated, e.g., "32,43,55")
     *   - minPrice (number)
     *   - maxPrice (number)
     *   - inStock (boolean)
     *   - search (string)
     * 
     * Examples:
     *   GET /products?page=1&limit=10
     *   GET /products?brands=LG,Samsung&sizes=32,43&minPrice=50&maxPrice=200&inStock=true
     *   GET /products?search=LED&page=1&limit=20
     */
    @Get()
    async findAll(
        @Query() query: ProductsQueryDto,
    ): Promise<PaginatedResponseDto<Product>> {
        const page = query.page || 1;
        const limit = query.limit || 10;
        
        const filters = {
            brands: query.brands,
            sizes: query.sizes,
            minPrice: query.minPrice,
            maxPrice: query.maxPrice,
            inStock: query.inStock,
            search: query.search,
        };
        
        const result = await this.productsService.findPaginated(page, limit, filters);
        
        return new PaginatedResponseDto(
            result.data,
            result.total,
            result.page,
            result.limit,
        );
    }

    /**
     * Get lightweight product data for crossfilter initialization
     * Returns only fields needed for filtering (no images, descriptions, etc.)
     * This endpoint is optimized for crossfilter - returns all products but with minimal data
     * Example: GET /products/filter-data
     */
    @Get('filter-data')
    async getFilterData(): Promise<FilterDataDto[]> {
        return this.productsService.findFilterData();
    }

    /**
     * Get all unique brands from products
     * Example: GET /products/brands
     */
    @Get('brands')
    async getBrands(): Promise<string[]> {
        return this.productsService.findAllBrands();
    }

    /**
     * Get search suggestions for autocomplete
     * Returns brands, references, and titles that match the search query
     * 
     * Query params:
     *   - q (required): Search query string (minimum 2 characters)
     *   - limit (optional): Maximum suggestions per category (default: 5, max: 20)
     * 
     * Examples:
     *   GET /products/search-suggestions?q=LED
     *   GET /products/search-suggestions?q=Samsung&limit=10
     */
    @Get('search-suggestions')
    async getSearchSuggestions(
        @Query() query: SearchSuggestionsQueryDto,
    ): Promise<SearchSuggestionsResponseDto> {
        // Validate minimum query length
        if (!query.q || query.q.trim().length < 2) {
            throw new BadRequestException('Search query must be at least 2 characters long');
        }

        const limit = query.limit || 5;
        const suggestions = await this.productsService.getSearchSuggestions(query.q, limit);

        return suggestions;
    }

    /**
     * Quick add product - for mobile scanner
     * Simplified endpoint that only requires reference code
     * Example: POST /products/quick-add
     * Body: { "reference": "3HI43DB", "brand": "Samsung", "stock": 5 }
     */
    @Post('quick-add')
    async quickAdd(@Body() dto: QuickAddProductDto): Promise<Product> {
        return this.productsService.quickAdd(dto);
    }

    /**
     * Scan image, extract reference code, save image, and create/update product
     * Fast server-side OCR (target: 3-4 seconds)
     * Example: POST /products/scan-and-add
     * FormData: image (file), additionalImages (files), and all product fields
     */
    @Post('scan-and-add')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'image', maxCount: 1 },
        { name: 'additionalImages', maxCount: 10 }
    ]))
    async scanAndAdd(
        @UploadedFiles() files: { image?: Express.Multer.File[], additionalImages?: Express.Multer.File[] },
        @Body() metadata?: ScanAndAddDto,
    ): Promise<{
        product: Product;
        reference: string;
        imageUrl: string;
        extractionTime: number;
        message: string;
    }> {
        const mainImage = files?.image?.[0];
        if (!mainImage) {
            throw new BadRequestException('No image file provided');
        }

        const additionalImages = files?.additionalImages || [];

        const result = await this.productsService.scanAndAdd(
            mainImage,
            metadata,
            additionalImages,
        );

        return {
            ...result,
            message: `Product ${result.product.id ? 'created' : 'updated'} successfully. Reference: ${result.reference}. OCR took ${result.extractionTime}ms`,
        };
    }

    @Get(':id')
    async findOne(@Param('id') id: string): Promise<Product> {
        return this.productsService.findOne(id);
    }

    @Post()
    async create(@Body() createProductDto: CreateProductDto): Promise<Product> {
        return this.productsService.create(createProductDto);
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() updateProductDto: UpdateProductDto,
    ): Promise<Product> {
        return this.productsService.update(id, updateProductDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id') id: string): Promise<void> {
        return this.productsService.remove(id);
    }

    /**
     * Delete multiple products by IDs
     * Example: DELETE /products/bulk
     * Body: { "ids": ["uuid1", "uuid2", "uuid3"] }
     */
    @Delete('bulk')
    async removeMany(@Body() dto: BulkDeleteProductsDto): Promise<{
        deletedCount: number;
        failedIds: string[];
        message: string;
    }> {
        const result = await this.productsService.removeMany(dto.ids);
        
        return {
            ...result,
            message: `Deleted ${result.deletedCount} product(s). ${result.failedIds.length > 0 ? `${result.failedIds.length} failed.` : 'All successful.'}`,
        };
    }
}
