import sharp from 'sharp';

export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export class ImageProcessor {
  /**
   * Process and optimize image
   */
  static async processImage(
    buffer: Buffer,
    options: ImageProcessingOptions = {}
  ): Promise<Buffer> {
    const {
      width = 1920, // Max width for product images
      height,
      quality = 85,
      format = 'jpeg',
    } = options;

    let processor = sharp(buffer);

    // Resize if dimensions provided
    if (width || height) {
      processor = processor.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert and optimize based on format
    switch (format) {
      case 'webp':
        processor = processor.webp({ quality });
        break;
      case 'png':
        processor = processor.png({ quality, compressionLevel: 9 });
        break;
      case 'jpeg':
      default:
        processor = processor.jpeg({ quality, mozjpeg: true });
        break;
    }

    return processor.toBuffer();
  }

  /**
   * Generate thumbnail (small version for listings)
   */
  static async generateThumbnail(buffer: Buffer): Promise<Buffer> {
    return this.processImage(buffer, {
      width: 400,
      height: 400,
      quality: 80,
      format: 'jpeg',
    });
  }

  /**
   * Get image metadata
   */
  static async getMetadata(buffer: Buffer) {
    return sharp(buffer).metadata();
  }
}

