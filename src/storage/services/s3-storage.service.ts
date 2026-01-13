import { Injectable } from '@nestjs/common';
import { IStorageService } from '../interfaces/storage.interface';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

@Injectable()
export class S3StorageService implements IStorageService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET', '');
    
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });

    // CloudFront URL or S3 bucket URL
    this.baseUrl = this.configService.get<string>('AWS_CLOUDFRONT_URL') || 
                   `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'products'): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    const key = `${folder}/${year}/${month}/${uniqueName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read', // Make files publicly accessible
    });

    await this.s3Client.send(command);
    return key;
  }

  async uploadFiles(files: Express.Multer.File[], folder: string = 'products'): Promise<string[]> {
    const uploadPromises = files.map(file => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  async deleteFile(filePath: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
    });

    await this.s3Client.send(command);
  }

  getFileUrl(filePath: string): string {
    return `${this.baseUrl}/${filePath}`;
  }
}


