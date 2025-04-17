import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioHealthIndicator extends HealthIndicator {
  private readonly minioClient: Minio.Client;
  private readonly logger = new Logger(MinioHealthIndicator.name);
  private readonly bucket: string;
  private minioConfig: any;

  constructor(private configService: ConfigService) {
    super();
    try {
      this.minioConfig = this.configService.get('minio');
      
      if (!this.minioConfig) {
        this.logger.error('Minio configuration is missing');
        return;
      }
      
      this.bucket = this.minioConfig.bucket;
      
      this.minioClient = new Minio.Client({
        endPoint: this.minioConfig.endPoint,
        port: this.minioConfig.port,
        useSSL: this.minioConfig.useSSL,
        accessKey: this.minioConfig.accessKey,
        secretKey: this.minioConfig.secretKey,
      });
      
      this.logger.log('MinIO client initialized with endpoint: ' + this.minioConfig.endPoint);
    } catch (error) {
      this.logger.error(`Failed to initialize MinIO client: ${error.message}`, error.stack);
    }
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    // Подготовим объект состояния
    const statusInfo = {
      bucket: this.bucket || 'unknown',
      endpoint: this.minioConfig?.endPoint || 'unknown',
      port: this.minioConfig?.port || 'unknown',
      useSSL: !!this.minioConfig?.useSSL
    };

    try {
      // Проверяем, что у нас есть клиент MinIO и имя бакета
      if (!this.minioClient || !this.bucket) {
        return this.getStatus(key, false, {
          ...statusInfo,
          message: 'MinIO client or bucket not configured properly'
        });
      }
      
      // Устанавливаем таймаут для операции проверки
      const bucketExists = await Promise.race([
        this.minioClient.bucketExists(this.bucket),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('MinIO connection timeout after 5000ms')), 5000)
        )
      ]);
      
      return this.getStatus(key, true, {
        ...statusInfo,
        bucketExists
      });
    } catch (error) {
      this.logger.error(`MinIO health check failed: ${error.message}`, error.stack);
      
      // Определяем конкретный тип ошибки для более информативного сообщения
      let errorMessage = error.message;
      let errorType = 'connection';
      
      if (error.message.includes('timeout')) {
        errorType = 'timeout';
      } else if (error.message.includes('certificate')) {
        errorType = 'ssl';
      } else if (error.message.includes('authentication') || error.message.includes('credentials')) {
        errorType = 'auth';
      } else if (error.message.includes('network')) {
        errorType = 'network';
      }
      
      return this.getStatus(key, false, {
        ...statusInfo,
        error: errorMessage,
        errorType,
        suggestions: this.getSuggestionsForError(errorType)
      });
    }
  }
  
  // Вспомогательный метод для предоставления рекомендаций по исправлению ошибок
  private getSuggestionsForError(errorType: string): string[] {
    switch (errorType) {
      case 'timeout':
        return [
          'Проверьте доступность сервера MinIO',
          'Возможно, сервер перегружен или не запущен'
        ];
      case 'ssl':
        return [
          'Проверьте настройки SSL',
          'Убедитесь, что сертификаты действительны'
        ];
      case 'auth':
        return [
          'Проверьте правильность ключей доступа (accessKey и secretKey)'
        ];
      case 'network':
        return [
          'Проверьте соединение с сервером MinIO',
          'Убедитесь, что порт и адрес сервера указаны правильно'
        ];
      default:
        return [
          'Проверьте настройки подключения к MinIO',
          'Убедитесь, что MinIO сервер запущен и доступен'
        ];
    }
  }
} 