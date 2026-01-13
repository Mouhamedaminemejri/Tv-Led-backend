import { Injectable } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class UploadService {
  constructor(private readonly storageService: StorageService) {}

  async uploadFile(file: Express.Multer.File, folder?: string): Promise<string> {
    return this.storageService.uploadFile(file, folder);
  }

  async uploadFiles(files: Express.Multer.File[], folder?: string): Promise<string[]> {
    return this.storageService.uploadFiles(files, folder);
  }

  async deleteFile(filePath: string): Promise<void> {
    return this.storageService.deleteFile(filePath);
  }

  getFileUrl(filePath: string): string {
    return this.storageService.getFileUrl(filePath);
  }
}


