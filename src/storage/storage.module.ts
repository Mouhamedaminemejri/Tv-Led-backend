import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStorageService } from './services/local-storage.service';
import { S3StorageService } from './services/s3-storage.service';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageService,
    S3StorageService,
    {
      provide: StorageService,
      useFactory: (configService: ConfigService, localStorage: LocalStorageService, s3Storage: S3StorageService) => {
        // Use S3 if configured, otherwise use local storage
        const storageType = configService.get<string>('STORAGE_TYPE', 'local');
        return storageType === 's3' ? s3Storage : localStorage;
      },
      inject: [ConfigService, LocalStorageService, S3StorageService],
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}

