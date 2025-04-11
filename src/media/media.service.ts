import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as sharp from 'sharp';
import { MediaFile, MediaType } from '../interfaces/media-file.interface';
import { MediaResponseDto } from '../dto/media-response.dto';
import { MediaValidatorService } from '../validators/media-validator.service';

@Injectable()
export class MediaService {
  private readonly minioClient: Minio.Client;
  private readonly logger = new Logger(MediaService.name);
  private readonly bucket: string;

  constructor(
    private configService: ConfigService,
    private mediaValidatorService: MediaValidatorService
  ) {
    const minioConfig = this.configService.get('minio');
    
    this.minioClient = new Minio.Client({
      endPoint: minioConfig.endPoint,
      port: minioConfig.port,
      useSSL: minioConfig.useSSL,
      accessKey: minioConfig.accessKey,
      secretKey: minioConfig.secretKey,
    });
    
    this.bucket = minioConfig.bucket;
    
    // Create bucket if it doesn't exist
    this.initBucket().catch(err => {
      this.logger.error(`Failed to initialize MinIO bucket: ${err.message}`);
    });
  }

  private async initBucket(): Promise<void> {
    const bucketExists = await this.minioClient.bucketExists(this.bucket);
    
    if (!bucketExists) {
      await this.minioClient.makeBucket(this.bucket, this.configService.get('minio.region'));
      this.logger.log(`Bucket '${this.bucket}' created successfully`);
      
      // Set bucket policy to allow public read
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      };
      
      await this.minioClient.setBucketPolicy(this.bucket, JSON.stringify(policy));
    }
  }

  async processAndUploadFile(file: MediaFile): Promise<MediaResponseDto> {
    // Валидация файла
    const validationResult = await this.mediaValidatorService.validateFile(file);
    const mediaType = validationResult.type;
    
    // Обработка изображения (сжатие для Instagram-подобного опыта)
    let processedBuffer = file.buffer;
    let processedSize = file.size;
    let dimensions = validationResult.dimensions;
    
    if (mediaType === MediaType.IMAGE) {
      // Обрабатываем изображение если оно превышает максимальное разрешение Instagram
      if (dimensions && (dimensions.width > 1080 || dimensions.height > 1080)) {
        const resizedImage = await sharp(file.buffer)
          .resize({
            width: dimensions.width > 1080 ? 1080 : undefined,
            height: dimensions.height > 1080 ? 1080 : undefined,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();
          
        processedBuffer = resizedImage;
        processedSize = resizedImage.length;
        
        // Обновляем размеры после сжатия
        const metadata = await sharp(resizedImage).metadata();
        dimensions = {
          width: metadata.width ?? 0,
          height: metadata.height ?? 0,
        };
      }
    }
    
    const extension = path.extname(file.originalname);
    const filename = `${uuidv4()}${extension}`;
    const subFolder = mediaType === MediaType.IMAGE ? 'images' : 'videos';
    const objectName = `${subFolder}/${filename}`;
    
    try {
      await this.minioClient.putObject(
        this.bucket,
        objectName,
        processedBuffer,
        processedSize,
        { 
          'Content-Type': file.mimetype,
          'X-Amz-Meta-Width': dimensions ? dimensions.width.toString() : '0',
          'X-Amz-Meta-Height': dimensions ? dimensions.height.toString() : '0',
          'X-Amz-Meta-Media-Type': mediaType,
        }
      );
      
      const minioConfig = this.configService.get('minio');
      const isSSL = minioConfig.useSSL;
      const protocol = isSSL ? 'https' : 'http';
      const url = `${protocol}://${minioConfig.endPoint}:${minioConfig.port}/${this.bucket}/${objectName}`;
      
      return {
        url,
        type: mediaType,
        filename,
        size: processedSize,
        width: dimensions ? dimensions.width : undefined,
        height: dimensions ? dimensions.height : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`);
      throw new BadRequestException('Failed to upload file: ' + error.message);
    }
  }

  // Метод для обработки нескольких файлов
  async processAndUploadMultipleFiles(files: MediaFile[]): Promise<MediaResponseDto[]> {
    return Promise.all(files.map(file => this.processAndUploadFile(file)));
  }
}