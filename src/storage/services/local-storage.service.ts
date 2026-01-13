import { Injectable } from '@nestjs/common';
import { IStorageService } from '../interfaces/storage.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly uploadPath: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    // Use environment variable or default to 'uploads' folder in project root
    const uploadDir = this.configService.get<string>('UPLOAD_PATH', 'uploads');
    this.uploadPath = path.isAbsolute(uploadDir) ? uploadDir : join(process.cwd(), uploadDir);
    this.baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:3001');
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'products'): Promise<string> {
    // Create folder structure: uploads/products/YYYY/MM
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const uploadDir = path.join(this.uploadPath, folder, String(year), month);

    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    const filePath = path.join(uploadDir, uniqueName);

    // Write file
    await fs.writeFile(filePath, file.buffer);

    // Return relative path for database storage
    return path.join(folder, String(year), month, uniqueName).replace(/\\/g, '/');
  }

  async uploadFiles(files: Express.Multer.File[], folder: string = 'products'): Promise<string[]> {
    const uploadPromises = files.map(file => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.uploadPath, filePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // File might not exist, ignore error
      console.warn(`Failed to delete file: ${fullPath}`, error);
    }
  }

  getFileUrl(filePath: string): string {
    // Return full URL for accessing the file
    return `${this.baseUrl}/uploads/${filePath}`;
  }
}

