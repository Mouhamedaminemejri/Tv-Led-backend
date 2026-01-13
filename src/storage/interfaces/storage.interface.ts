export interface IStorageService {
  uploadFile(file: Express.Multer.File, folder?: string): Promise<string>;
  uploadFiles(files: Express.Multer.File[], folder?: string): Promise<string[]>;
  deleteFile(filePath: string): Promise<void>;
  getFileUrl(filePath: string): string;
}


