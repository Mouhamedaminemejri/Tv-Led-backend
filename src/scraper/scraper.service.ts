import { Injectable, Logger, Inject } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import { PrismaClient } from '@prisma/client';

export interface ScrapedProduct {
  title: string;
  imageUrl: string;
  price?: string;
  url?: string;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly baseUrl = 'https://bareteledtv.ro';

  constructor(
    @Inject(StorageService) private readonly storageService: StorageService,
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Search for products on the website by title
   */
  async searchProductByTitle(title: string): Promise<ScrapedProduct | null> {
    try {
      // Clean and normalize the title for search
      const searchQuery = this.normalizeTitle(title);
      this.logger.log(`Searching for product: ${title}`);

      // Search the website - try multiple approaches
      const product = await this.searchInProductListings(searchQuery, title);

      if (product) {
        this.logger.log(`Found product: ${product.title}`);
        return product;
      }

      this.logger.warn(`Product not found: ${title}`);
      return null;
    } catch (error) {
      this.logger.error(`Error searching for product ${title}:`, error);
      return null;
    }
  }

  /**
   * Search for products on the website by reference code
   * Uses the website's search form functionality
   */
  async searchProductByReference(reference: string): Promise<ScrapedProduct | null> {
    try {
      this.logger.log(`Searching for product by reference: ${reference}`);

      // Use the website's search functionality - try multiple search endpoint formats
      const searchUrls = [
        // PrestaShop search format
        `${this.baseUrl}/cautare?controller=search&orderby=position&orderway=desc&search_query=${encodeURIComponent(reference)}`,
        // Simple search format
        `${this.baseUrl}/search?search_query=${encodeURIComponent(reference)}`,
        `${this.baseUrl}/cautare?search_query=${encodeURIComponent(reference)}`,
        // Alternative formats
        `${this.baseUrl}/search?q=${encodeURIComponent(reference)}`,
        `${this.baseUrl}/cautare?q=${encodeURIComponent(reference)}`,
      ];

      let response: any = null;
      let lastError: any = null;

      // Try each search URL format - PrestaShop search might need POST
      for (const searchUrl of searchUrls) {
        try {
          this.logger.log(`Trying search URL: ${searchUrl}`);
          
          // Try GET first
          response = await axios.get(searchUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
              'Accept-Encoding': 'gzip, deflate, br',
              Connection: 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              Referer: `${this.baseUrl}/`,
            },
            timeout: 25000,
            maxRedirects: 10,
            validateStatus: (status) => status < 500,
            // Don't automatically decompress - let axios handle it
            decompress: true,
          });

          // Check if we got redirected to search results page
          const finalUrl = response.request?.responseURL || response.config?.url || searchUrl;
          this.logger.log(`Final URL after redirect: ${finalUrl}`);
          
          // Check if response contains search results (not just redirected to homepage)
          const responseText = response.data?.toString() || '';
          const hasSearchResults = 
            responseText.includes('rezultatele cautarii') ||
            responseText.includes('rezultatele căutării') ||
            responseText.includes('Contine') ||
            responseText.includes('produs') ||
            responseText.includes('thumbnail-container');

          if (response && response.status === 200 && hasSearchResults) {
            this.logger.log(`✅ Successfully fetched search results from: ${searchUrl}`);
            break; // Success, exit loop
          } else if (response && response.status === 200) {
            this.logger.warn(`Got 200 but no search results found. Final URL: ${finalUrl}`);
            // Try POST method for PrestaShop
            try {
              const postResponse = await axios.post(
                `${this.baseUrl}/cautare`,
                `controller=search&orderby=position&orderway=desc&search_query=${encodeURIComponent(reference)}`,
                {
                  headers: {
                    'User-Agent':
                      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Referer: `${this.baseUrl}/`,
                  },
                  timeout: 25000,
                  maxRedirects: 10,
                  validateStatus: (status) => status < 500,
                }
              );
              
              const postResponseText = postResponse.data?.toString() || '';
              const postHasResults = 
                postResponseText.includes('rezultatele cautarii') ||
                postResponseText.includes('rezultatele căutării') ||
                postResponseText.includes('Contine') ||
                postResponseText.includes('thumbnail-container');
              
              if (postResponse.status === 200 && postHasResults) {
                this.logger.log(`✅ Successfully fetched search results via POST`);
                response = postResponse;
                break;
              }
            } catch (postError: any) {
              this.logger.warn(`POST search also failed: ${postError.message}`);
            }
          }
        } catch (error: any) {
          lastError = error;
          // Don't log connection reset as error if we got some data
          if (error.code !== 'ECONNRESET' || !error.response) {
            this.logger.warn(`Search URL failed: ${searchUrl} - ${error.message}`);
          }
          continue; // Try next URL
        }
      }

      if (!response || response.status !== 200) {
        this.logger.error(`All search URLs failed. Last error: ${lastError?.message}`);
        return null;
      }

      // Check if we actually got search results (not redirected to homepage)
      const responseText = typeof response.data === 'string' 
        ? response.data 
        : response.data?.toString() || '';
      
      // Check for search results indicators
      const hasSearchResults = 
        responseText.includes('rezultatele cautarii') ||
        responseText.includes('rezultatele căutării') ||
        responseText.includes('Rezultatele cautarii') ||
        responseText.includes('Rezultatele căutării') ||
        responseText.includes('Contine') ||
        responseText.includes('produs') ||
        responseText.includes('thumbnail-container') ||
        responseText.includes('product-thumbnail');

      if (!hasSearchResults) {
        this.logger.warn(`Search response doesn't contain search results. Response length: ${responseText.length}`);
        this.logger.warn(`Response preview: ${responseText.substring(0, 500)}`);
        // Still try to parse - maybe the product is there
      }

      const $ = cheerio.load(response.data);

      // Look for product in search results - try multiple selectors
      let bestMatch: ScrapedProduct | null = null;
      const referenceUpper = reference.toUpperCase();

      // Try different product container selectors - prioritize thumbnail-container
      const selectors = [
        '.thumbnail-container',
        '.product-thumbnail',
        'article.product-miniature',
        '.product-miniature',
        '.product-item',
        '.product',
        'article',
        '[class*="product"]',
        '.item',
        '.product-container',
        '.ajax_block_product',
      ];

      for (const selector of selectors) {
        const productElements = $(selector);
        this.logger.log(`Checking ${productElements.length} elements with selector: ${selector}`);
        
        for (let i = 0; i < productElements.length; i++) {
          const element = productElements[i];
          const $element = $(element);
          
          // Get all text content from this element and its children
          const productText = $element.text().toUpperCase();
          const productHref = $element.find('a').first().attr('href') || '';
          const imgAlt = $element.find('img').first().attr('alt') || '';
          const imgSrc = $element.find('img').first().attr('src') || '';
          const imgDataSrc = $element.find('img').first().attr('data-src') || '';
          
          // More flexible matching - check if reference appears anywhere
          const referenceInText = productText.includes(referenceUpper);
          const referenceInHref = productHref.toUpperCase().includes(referenceUpper);
          const referenceInAlt = imgAlt.toUpperCase().includes(referenceUpper);
          const referenceInSrc = (imgSrc + imgDataSrc).toUpperCase().includes(referenceUpper);
          
          if (referenceInText || referenceInHref || referenceInAlt || referenceInSrc) {
            this.logger.log(`Found reference ${reference} in element ${i} with selector ${selector}`);
            
            // Get product title from multiple possible locations
            let productTitle =
              $element.find('h2 a, h3 a, .product-title a, .product-name a').first().text().trim() ||
              $element.find('h2, h3, .product-title, .product-name').first().text().trim() ||
              $element.find('a[title]').first().attr('title') ||
              imgAlt.trim() ||
              $element.find('a.product-thumbnail').attr('title') ||
              '';

            // If title is too long, try to get a shorter version
            if (productTitle.length > 200) {
              productTitle = productTitle.substring(0, 200);
            }

            // Get image URL - prioritize full-size, then src, then data attributes
            const imgElement = $element.find('img').first();
            const imageUrl =
              imgElement.attr('data-full-size-image-url') || // Highest quality
              imgElement.attr('src') || // Already loaded
              imgElement.attr('data-src') || // Lazy load source
              imgElement.attr('data-lazy-src') ||
              imgElement.attr('data-original') ||
              imgElement.attr('data-lazy') ||
              '';

            // Get product URL - try multiple locations
            const productUrl = 
              productHref ||
              $element.find('a.product-thumbnail').attr('href') ||
              $element.find('a').first().attr('href') ||
              '';

            if (imageUrl) {
              // If no title found, use reference or image alt
              if (!productTitle) {
                productTitle = imgAlt.trim() || reference;
              }

              bestMatch = {
                title: productTitle,
                imageUrl: this.resolveImageUrl(imageUrl),
                url: this.resolveUrl(productUrl),
              };
              this.logger.log(`✅ Found product by reference using selector ${selector}: ${productTitle}`);
              break;
            } else {
              this.logger.warn(`Found reference but no image URL in element ${i}`);
            }
          }
        }

        if (bestMatch) break; // Found, exit outer loop
      }

      // If still not found, search in all thumbnail links and images
      if (!bestMatch) {
        $('a.thumbnail, a.product-thumbnail, .thumbnail-container a').each((index, element) => {
          const $link = $(element);
          const linkText = $link.text().toUpperCase();
          const linkHref = $link.attr('href') || '';
          const imgAlt = $link.find('img').first().attr('alt') || '';

          if (
            linkText.includes(referenceUpper) ||
            linkHref.toUpperCase().includes(referenceUpper) ||
            imgAlt.toUpperCase().includes(referenceUpper)
          ) {
            const img = $link.find('img').first();
            const imgUrl =
              img.attr('data-full-size-image-url') || // Highest quality
              img.attr('src') ||
              img.attr('data-src') ||
              img.attr('data-lazy-src') ||
              img.attr('data-original') ||
              '';

            if (imgUrl) {
              bestMatch = {
                title: imgAlt.trim() || $link.text().trim() || linkHref,
                imageUrl: this.resolveImageUrl(imgUrl),
                url: this.resolveUrl(linkHref),
              };
              return false; // Break cheerio each loop
            }
          }
        });
      }

      // Last resort: search all images - check if reference appears near the image
      if (!bestMatch) {
        $('img').each((index, element) => {
          const $img = $(element);
          const imgAlt = ($img.attr('alt') || '').toUpperCase();
          const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
          
          // Check parent elements for reference
          const $parent = $img.closest('.thumbnail-container, .product-thumbnail, article, .product');
          const parentText = $parent.text().toUpperCase();
          const parentHref = $parent.find('a').first().attr('href') || '';

          if (
            (imgAlt.includes(referenceUpper) || 
             parentText.includes(referenceUpper) ||
             parentHref.toUpperCase().includes(referenceUpper)) && 
            imgSrc
          ) {
            const productLink = parentHref || $img.closest('a').attr('href') || '';
            const productTitle = 
              $img.attr('alt')?.trim() ||
              $parent.find('h2, h3, .product-title, .product-name').first().text().trim() ||
              reference;
            
            bestMatch = {
              title: productTitle,
              imageUrl: this.resolveImageUrl(
                $img.attr('data-full-size-image-url') ||
                $img.attr('src') ||
                $img.attr('data-src') ||
                '',
              ),
              url: this.resolveUrl(productLink),
            };
            this.logger.log(`✅ Found product by reference (image search): ${productTitle}`);
            return false; // Break cheerio each loop
          }
        });
      }

      if (bestMatch) {
        this.logger.log(`✅ Found product by reference: ${bestMatch.title}`);
        return bestMatch;
      }

      // Debug: Log what we found on the page
      const productCount = $('.thumbnail-container, .product-thumbnail').length;
      const allImages = $('img').length;
      const pageText = $.text().toUpperCase();
      const referenceInPage = pageText.includes(referenceUpper);
      
      this.logger.warn(
        `Product not found by reference: ${reference}. Found ${productCount} product containers, ${allImages} images. Reference in page: ${referenceInPage}`,
      );

      // Last resort: if reference is in page text, extract the FIRST product from search results
      if (referenceInPage && !bestMatch) {
        this.logger.log(`Reference found in page text, extracting first product from search results...`);
        
        // Try to get the first product from search results
        const firstProduct = $('.thumbnail-container, .product-miniature, article.product-miniature').first();
        
        if (firstProduct.length > 0) {
          const $product = $(firstProduct);
          
          // Get image
          const img = $product.find('img').first();
          const imgUrl =
            img.attr('data-full-size-image-url') ||
            img.attr('src') ||
            img.attr('data-src') ||
            '';
          
          // Get title
          const productTitle =
            $product.find('h2 a, h3 a, .product-title a, .product-name a').first().text().trim() ||
            $product.find('h2, h3, .product-title, .product-name').first().text().trim() ||
            img.attr('alt')?.trim() ||
            $product.find('a.product-thumbnail').attr('title') ||
            '';
          
          // Get link
          const productLink =
            $product.find('a.product-thumbnail').attr('href') ||
            $product.find('a').first().attr('href') ||
            '';
          
          if (imgUrl) {
            bestMatch = {
              title: productTitle || reference,
              imageUrl: this.resolveImageUrl(imgUrl),
              url: this.resolveUrl(productLink),
            };
            this.logger.log(`✅ Found product by reference (first product method): ${bestMatch.title}`);
          }
        }
        
        // If still not found, try searching all elements for reference and extract nearby image
        if (!bestMatch) {
          $('*').each((index, element) => {
            const $el = $(element);
            const elText = $el.text().toUpperCase();
            
            // Check if this element contains the reference and has reasonable text length
            if (elText.includes(referenceUpper) && elText.length > 10 && elText.length < 1000 && !bestMatch) {
              // Look for image in this element, parent, or nearby containers
              let img = $el.find('img').first();
              if (img.length === 0) {
                img = $el.closest('.thumbnail-container, .product-thumbnail, .product-miniature, article').find('img').first();
              }
              if (img.length === 0) {
                img = $el.parent().find('img').first();
              }
              
              const imgUrl =
                img.attr('data-full-size-image-url') ||
                img.attr('src') ||
                img.attr('data-src') ||
                '';
              
              if (imgUrl) {
                const link = 
                  $el.closest('a').attr('href') || 
                  $el.find('a').first().attr('href') || 
                  img.closest('a').attr('href') ||
                  $el.closest('.thumbnail-container, .product-miniature').find('a').first().attr('href') ||
                  '';
                
                const title = 
                  img.attr('alt')?.trim() ||
                  $el.text().trim().substring(0, 200) ||
                  reference;
                
                bestMatch = {
                  title: title,
                  imageUrl: this.resolveImageUrl(imgUrl),
                  url: this.resolveUrl(link),
                };
                this.logger.log(`✅ Found product by reference (element search method): ${bestMatch.title}`);
                return false; // Break cheerio each loop
              }
            }
          });
        }
      }

      if (bestMatch) {
        return bestMatch;
      }

      this.logger.warn(`Product not found by reference: ${reference} after all attempts`);
      return null;
    } catch (error: any) {
      this.logger.error(`Error searching for product by reference ${reference}:`, error.message);
      return null;
    }
  }

  /**
   * Search in product listings page
   */
  private async searchInProductListings(
    searchQuery: string,
    originalTitle: string,
  ): Promise<ScrapedProduct | null> {
    try {
      // Search the main products page
      const searchUrl = `${this.baseUrl}/10-barete-led-tv`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);

      // Find product cards/items - try multiple selectors
      let bestMatch: ScrapedProduct | null = null;
      let bestScore = 0;

      // Extract key terms from original title for better matching
      const originalTerms = this.extractKeyTerms(originalTitle.toLowerCase());
      const originalBrand = this.extractBrand(originalTitle);
      const originalSize = this.extractSize(originalTitle);

      // Try different selectors
      const selectors = [
        '.product-item',
        '.product',
        'article',
        '[class*="product"]',
        '.item',
        '[class*="item"]',
      ];

      selectors.forEach((selector) => {
        $(selector).each((index, element) => {
          const $element = $(element);
          
          // Extract product title from various possible locations
          let productTitle =
            $element.find('h2 a, h3 a').first().text().trim() ||
            $element.find('h2, h3').first().text().trim() ||
            $element.find('.title a, .product-title a').first().text().trim() ||
            $element.find('a[title]').first().attr('title') ||
            $element.find('a').first().text().trim();

          if (!productTitle || productTitle.length < 10) return;

          // Extract image URL from various attributes
          const imageUrl =
            $element.find('img').first().attr('src') ||
            $element.find('img').first().attr('data-src') ||
            $element.find('img').first().attr('data-lazy-src') ||
            $element.find('img').first().attr('data-original') ||
            '';

          if (!imageUrl) return;

          // Extract product URL
          const productUrl =
            $element.find('a').first().attr('href') || '';

          // Calculate similarity score with improved matching
          const similarity = this.calculateImprovedSimilarity(
            originalTitle.toLowerCase(),
            productTitle.toLowerCase(),
            originalTerms,
            originalBrand,
            originalSize,
          );

          if (similarity > bestScore && similarity > 0.5) {
            bestScore = similarity;
            bestMatch = {
              title: productTitle,
              imageUrl: this.resolveImageUrl(imageUrl),
              url: this.resolveUrl(productUrl),
            };
          }
        });
      });

      // If still no match, search through all links with images
      if (!bestMatch) {
        $('a').each((index, element) => {
          const $link = $(element);
          const linkText = $link.text().trim();
          const linkHref = $link.attr('href') || '';
          const img = $link.find('img').first();
          const imgUrl =
            img.attr('src') ||
            img.attr('data-src') ||
            img.attr('data-lazy-src') ||
            '';

          if (linkText && imgUrl && linkText.length > 10) {
            const similarity = this.calculateImprovedSimilarity(
              originalTitle.toLowerCase(),
              linkText.toLowerCase(),
              originalTerms,
              originalBrand,
              originalSize,
            );

            if (similarity > bestScore && similarity > 0.5) {
              bestScore = similarity;
              bestMatch = {
                title: linkText,
                imageUrl: this.resolveImageUrl(imgUrl),
                url: this.resolveUrl(linkHref),
              };
            }
          }
        });
      }

      this.logger.log(
        `Best match score: ${bestScore} for "${originalTitle}"`,
      );

      return bestMatch;
    } catch (error) {
      this.logger.error('Error searching product listings:', error);
      return null;
    }
  }

  /**
   * Sanitize title for folder name
   */
  private sanitizeFolderName(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 100); // Limit length to 100 characters
  }

  /**
   * Download image from URL and store it in organized folder structure
   * Includes retry logic for transient network errors
   */
  async downloadAndStoreImage(
    imageUrl: string,
    productReference: string,
    productTitle: string,
    maxRetries: number = 3,
  ): Promise<string | null> {
    if (!imageUrl || !imageUrl.startsWith('http')) {
      this.logger.warn(`Invalid image URL: ${imageUrl}`);
      return null;
    }

    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(
          `Downloading image from: ${imageUrl} (attempt ${attempt}/${maxRetries})`,
        );

        // Download image with increased timeout and better error handling
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
            Referer: this.baseUrl,
          },
          timeout: 20000, // Increased timeout to 20 seconds
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400,
        });

        // Get file extension from URL or content-type
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const extension = this.getExtensionFromContentType(contentType);
        const fileName = `${productReference}-${Date.now()}.${extension}`;

        // Create folder structure: products/{sanitized-title}/images/
        const folderName = this.sanitizeFolderName(productTitle);
        const folderPath = `products/${folderName}/images`;

        // Create a file-like object for storage service
        const file: Express.Multer.File = {
          fieldname: 'image',
          originalname: fileName,
          encoding: '7bit',
          mimetype: contentType,
          buffer: Buffer.from(response.data),
          size: response.data.length,
          destination: '',
          filename: fileName,
          path: '',
          stream: null as any,
        };

        // Upload to storage with organized folder structure
        const filePath = await this.storageService.uploadFile(file, folderPath);
        const fileUrl = this.storageService.getFileUrl(filePath);

        this.logger.log(`Image stored at: ${fileUrl} in folder: ${folderPath}`);
        return fileUrl;
      } catch (error: any) {
        lastError = error;
        const isRetryable =
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'EAI_AGAIN' ||
          (error.response && error.response.status >= 500);

        if (isRetryable && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          this.logger.warn(
            `Download failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        } else {
          this.logger.error(
            `Error downloading image from ${imageUrl} (attempt ${attempt}/${maxRetries}):`,
            error.message || error,
          );
          if (attempt === maxRetries) {
            return null;
          }
        }
      }
    }

    return null;
  }

  /**
   * Scrape and update product images
   */
  async scrapeAndUpdateProduct(
    productId: string,
    productTitle: string,
    productReference: string,
  ): Promise<{ success: boolean; imageUrl?: string; message: string }> {
    try {
      // Try searching by reference first (more accurate)
      let scrapedProduct = await this.searchProductByReference(productReference);

      // If not found by reference, try by title
      if (!scrapedProduct) {
        scrapedProduct = await this.searchProductByTitle(productTitle);
      }

      if (!scrapedProduct || !scrapedProduct.imageUrl) {
        return {
          success: false,
          message: `Product not found on website (reference: ${productReference}, title: ${productTitle})`,
        };
      }

      // Download and store image
      const storedImageUrl = await this.downloadAndStoreImage(
        scrapedProduct.imageUrl,
        productReference,
        productTitle,
      );

      if (!storedImageUrl) {
        return {
          success: false,
          message: `Failed to download image for: ${productTitle}`,
        };
      }

      return {
        success: true,
        imageUrl: storedImageUrl,
        message: `Successfully scraped and stored image for: ${productTitle}`,
      };
    } catch (error: any) {
      this.logger.error(`Error scraping product ${productId}:`, error);
      return {
        success: false,
        message: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Normalize title for search
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate improved similarity with brand and size matching
   */
  private calculateImprovedSimilarity(
    str1: string,
    str2: string,
    terms1: string[],
    brand1: string | null,
    size1: string | null,
  ): number {
    const terms2 = this.extractKeyTerms(str2);
    const brand2 = this.extractBrand(str2);
    const size2 = this.extractSize(str2);

    let score = 0;
    let maxScore = 0;

    // Brand match (high weight)
    if (brand1 && brand2 && brand1 === brand2) {
      score += 0.4;
    }
    maxScore += 0.4;

    // Size match (high weight)
    if (size1 && size2 && size1 === size2) {
      score += 0.3;
    }
    maxScore += 0.3;

    // Term matches
    let termMatches = 0;
    terms1.forEach((term) => {
      if (terms2.some((t) => t.includes(term) || term.includes(t))) {
        termMatches++;
      }
    });

    const termScore = terms1.length > 0 ? termMatches / terms1.length : 0;
    score += termScore * 0.3;
    maxScore += 0.3;

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Extract brand from title
   */
  private extractBrand(title: string): string | null {
    const brands = [
      'lg',
      'samsung',
      'philips',
      'sony',
      'panasonic',
      'sharp',
      'toshiba',
      'vestel',
      'grundig',
      'hisense',
      'tcl',
      'thomson',
      'telefunken',
      'hitachi',
      'vortex',
      'nei',
    ];
    const lowerTitle = title.toLowerCase();
    for (const brand of brands) {
      if (lowerTitle.includes(brand)) {
        return brand;
      }
    }
    return null;
  }

  /**
   * Extract size from title
   */
  private extractSize(title: string): string | null {
    const sizeMatch = title.match(/(\d+)\s*[""]?\s*inch/i);
    return sizeMatch ? sizeMatch[1] : null;
  }

  /**
   * Extract key terms from title (brand, size, model numbers)
   */
  private extractKeyTerms(title: string): string[] {
    const terms: string[] = [];
    
    // Extract brand names
    const brands = ['lg', 'samsung', 'philips', 'sony', 'panasonic', 'sharp', 'toshiba', 'vestel', 'grundig', 'hisense', 'tcl', 'thomson', 'telefunken', 'hitachi', 'vortex', 'nei'];
    brands.forEach(brand => {
      if (title.includes(brand)) {
        terms.push(brand);
      }
    });

    // Extract size (number before "inch" or ")
    const sizeMatch = title.match(/(\d+)\s*[""]?\s*inch/i);
    if (sizeMatch) {
      terms.push(sizeMatch[1]);
    }

    // Extract model numbers (alphanumeric codes)
    const modelMatches = title.match(/\b[A-Z0-9]{4,}\b/g);
    if (modelMatches) {
      terms.push(...modelMatches.slice(0, 3)); // Take first 3 model codes
    }

    return terms;
  }

  /**
   * Resolve relative image URL to absolute URL
   */
  private resolveImageUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `${this.baseUrl}${url}`;
    return `${this.baseUrl}/${url}`;
  }

  /**
   * Resolve relative URL to absolute URL
   */
  private resolveUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `${this.baseUrl}${url}`;
    return `${this.baseUrl}/${url}`;
  }

  /**
   * Get file extension from content type
   */
  private getExtensionFromContentType(contentType: string): string {
    const mapping: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    return mapping[contentType.toLowerCase()] || 'jpg';
  }

  /**
   * Batch scrape products and update their images
   * Automatically loops through database products and uses their reference codes
   */
  async batchScrapeProducts(limit?: number): Promise<{
    total: number;
    success: number;
    failed: number;
    results: Array<{
      productId: string;
      reference: string;
      title: string;
      success: boolean;
      imageUrl?: string;
      message: string;
    }>;
  }> {
    // Get products without images or with empty images array
    const whereClause: any = {
      OR: [
        { images: { equals: [] } },
        { images: { equals: null } },
      ],
    };

    const products = limit
      ? await this.prisma.product.findMany({
          where: whereClause,
          take: limit,
          select: {
            id: true,
            title: true,
            reference: true,
            images: true,
          },
        })
      : await this.prisma.product.findMany({
          where: whereClause,
          select: {
            id: true,
            title: true,
            reference: true,
            images: true,
          },
        });

    this.logger.log(`Found ${products.length} products to scrape`);

    if (products.length === 0) {
      return {
        total: 0,
        success: 0,
        failed: 0,
        results: [],
      };
    }

    const results: Array<{
      productId: string;
      reference: string;
      title: string;
      success: boolean;
      imageUrl?: string;
      message: string;
    }> = [];

    let successCount = 0;
    let failedCount = 0;

    for (const product of products) {
      try {
        this.logger.log(
          `Scraping product ${product.id} - Reference: ${product.reference}`,
        );

        // Search by reference first (more accurate)
        let scrapedProduct = await this.searchProductByReference(
          product.reference,
        );

        // If not found by reference, try by title
        if (!scrapedProduct) {
          this.logger.log(
            `Product not found by reference, trying title: ${product.title}`,
          );
          scrapedProduct = await this.searchProductByTitle(product.title);
        }

        if (!scrapedProduct || !scrapedProduct.imageUrl) {
          failedCount++;
          results.push({
            productId: product.id,
            reference: product.reference,
            title: product.title,
            success: false,
            message: `Product not found on website (reference: ${product.reference})`,
          });
          // Add delay even for failed searches
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // Download and store image
        const storedImageUrl = await this.downloadAndStoreImage(
          scrapedProduct.imageUrl,
          product.reference,
          product.title,
        );

        if (!storedImageUrl) {
          failedCount++;
          results.push({
            productId: product.id,
            reference: product.reference,
            title: product.title,
            success: false,
            message: `Failed to download image for reference: ${product.reference}`,
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // Update product with scraped image
        await this.prisma.product.update({
          where: { id: product.id },
          data: {
            images: [storedImageUrl],
          },
        });

        successCount++;
        results.push({
          productId: product.id,
          reference: product.reference,
          title: product.title,
          success: true,
          imageUrl: storedImageUrl,
          message: `Successfully scraped and stored image for reference: ${product.reference}`,
        });

        this.logger.log(
          `✅ Successfully scraped product ${product.reference} - Image: ${storedImageUrl}`,
        );

        // Add delay to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        this.logger.error(
          `Error scraping product ${product.id} (${product.reference}):`,
          error,
        );
        failedCount++;
        results.push({
          productId: product.id,
          reference: product.reference,
          title: product.title,
          success: false,
          message: `Error: ${error.message}`,
        });
        // Add delay even for errors
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.log(
      `Batch scraping completed: ${successCount} success, ${failedCount} failed out of ${products.length} total`,
    );

    return {
      total: products.length,
      success: successCount,
      failed: failedCount,
      results,
    };
  }
}

