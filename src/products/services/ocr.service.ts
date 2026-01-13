import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createWorker, Worker } from 'tesseract.js';

@Injectable()
export class OcrService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);
  private worker: Worker | null = null;

  /**
   * Initialize OCR worker on module init (reuse for faster processing)
   */
  async onModuleInit() {
    try {
      this.logger.log('Initializing OCR worker...');
      this.worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            this.logger.debug(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });
      
      // Configure for faster processing (lower accuracy but faster)
      await this.worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        // tessedit_pageseg_mode: 6, // Removed - use default for compatibility
      });
      
      this.logger.log('OCR worker initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OCR worker:', error);
    }
  }

  /**
   * Cleanup worker on module destroy
   */
  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Get OCR worker (create if not exists)
   */
  private async getWorker(): Promise<Worker> {
    if (!this.worker) {
      this.logger.warn('Worker not initialized, creating new one...');
      this.worker = await createWorker('eng', 1);
      await this.worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      });
    }
    return this.worker;
  }

  /**
   * Extract reference code from image buffer
   * Optimized for speed (target: 3-4 seconds)
   */
  async extractReferenceCode(imageBuffer: Buffer): Promise<string | null> {
    const startTime = Date.now();
    
    try {
      this.logger.log('Starting OCR extraction...');
      
      const worker = await this.getWorker();
      
      // Perform OCR with optimized settings
      const { data: { text } } = await worker.recognize(imageBuffer);

      const extractionTime = Date.now() - startTime;
      this.logger.log(`OCR completed in ${extractionTime}ms`);

      // Find reference code pattern (e.g., 3HI43DB, 1LGAL2491)
      // Look for alphanumeric codes 6+ characters
      const referencePattern = /[A-Z0-9]{6,}/g;
      const matches = text.match(referencePattern);

      if (matches && matches.length > 0) {
        // Use the longest match (likely the reference)
        const reference = matches.sort((a, b) => b.length - a.length)[0];
        this.logger.log(`Extracted reference: ${reference} (took ${extractionTime}ms)`);
        return reference;
      }

      this.logger.warn('No reference code found in image');
      return null;
    } catch (error: any) {
      this.logger.error(`OCR extraction failed: ${error.message}`);
      return null;
    }
  }
}

