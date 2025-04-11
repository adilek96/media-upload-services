import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaValidatorService } from '../validators/media-validator.service';
import minioConfig from '../config/minio.config';

@Module({
  imports: [
    ConfigModule.forFeature(minioConfig),
  ],
  controllers: [MediaController],
  providers: [MediaService, MediaValidatorService],
  exports: [MediaService],
})
export class MediaModule {}