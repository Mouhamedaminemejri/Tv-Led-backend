import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { ScraperService, ScrapedProduct } from './scraper.service';
import { ScrapeProductDto } from './dto/scrape-product.dto';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post('product/:id')
  async scrapeProduct(
    @Param('id') productId: string,
    @Body() scrapeDto: ScrapeProductDto,
  ) {
    if (!scrapeDto.title || !scrapeDto.reference) {
      throw new BadRequestException('title and reference are required');
    }

    return this.scraperService.scrapeAndUpdateProduct(
      productId,
      scrapeDto.title,
      scrapeDto.reference,
    );
  }

  @Get('search')
  async searchProduct(
    @Query('title') title?: string,
    @Query('reference') reference?: string,
  ): Promise<ScrapedProduct | null> {
    if (reference) {
      return this.scraperService.searchProductByReference(reference);
    }
    
    if (title) {
      return this.scraperService.searchProductByTitle(title);
    }

    throw new BadRequestException('Either title or reference query parameter is required');
  }

  @Post('batch')
  async batchScrapeProducts(@Body('limit') limit?: number) {
    // If no limit provided, scrape all products without images
    return this.scraperService.batchScrapeProducts(limit);
  }
}

