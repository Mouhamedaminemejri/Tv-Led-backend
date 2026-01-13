import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { ImageProcessor } from '../storage/utils/image-processor.util';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('single')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Process and optimize image
    const processedBuffer = await ImageProcessor.processImage(file.buffer, {
      width: 1920,
      quality: 85,
      format: 'jpeg',
    });

    // Create new file object with processed buffer
    const processedFile: Express.Multer.File = {
      ...file,
      buffer: processedBuffer,
      size: processedBuffer.length,
    };

    const filePath = await this.uploadService.uploadFile(processedFile, folder);
    const url = this.uploadService.getFileUrl(filePath);

    return {
      success: true,
      filePath,
      url,
      size: processedFile.size,
    };
  }

  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folder') folder?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Validate file sizes and types
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = /(jpg|jpeg|png|webp)$/i;

    for (const file of files) {
      if (file.size > maxSize) {
        throw new BadRequestException(`File ${file.originalname} exceeds maximum size of 5MB`);
      }
      if (!allowedTypes.test(file.mimetype)) {
        throw new BadRequestException(`File ${file.originalname} is not a valid image type`);
      }
    }

    // Process all images
    const processedFiles = await Promise.all(
      files.map(async (file) => {
        const processedBuffer = await ImageProcessor.processImage(file.buffer, {
          width: 1920,
          quality: 85,
          format: 'jpeg',
        });

        return {
          ...file,
          buffer: processedBuffer,
          size: processedBuffer.length,
        };
      }),
    );

    const filePaths = await this.uploadService.uploadFiles(processedFiles, folder);
    const urls = filePaths.map((path) => this.uploadService.getFileUrl(path));

    return {
      success: true,
      files: filePaths.map((filePath, index) => ({
        filePath,
        url: urls[index],
        size: processedFiles[index].size,
      })),
    };
  }
}

