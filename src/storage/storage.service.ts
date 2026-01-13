import { Injectable } from '@nestjs/common';
import type { IStorageService } from './interfaces/storage.interface';

@Injectable()
export class StorageService {
  constructor(private readonly storage: IStorageService) {}

  uploadFile(file: Express.Multer.File, folder?: string): Promise<string> {
    return this.storage.uploadFile(file, folder);
  }

  uploadFiles(files: Express.Multer.File[], folder?: string): Promise<string[]> {
    return this.storage.uploadFiles(files, folder);
  }

  deleteFile(filePath: string): Promise<void> {
    return this.storage.deleteFile(filePath);
  }

  getFileUrl(filePath: string): string {
    return this.storage.getFileUrl(filePath);
  }
}

