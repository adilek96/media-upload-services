import { Controller, Get, Logger } from '@nestjs/common';
import { 
  HealthCheck, 
  HealthCheckService, 
  HttpHealthIndicator,
  HealthCheckResult 
} from '@nestjs/terminus';
import { MinioHealthIndicator } from './indicators/minio.health';

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private minioIndicator: MinioHealthIndicator,
  ) {}

  @Get('health')
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    try {
      const result = {
        status: 'ok',
        info: {},
        error: {},
        details: {}
      };

      // Проверка API загрузки
      try {
        // Проверяем доступность API загрузки
        const apiCheck = await this.http.pingCheck('upload_api', 'http://localhost:4003/media');
        result.info = { ...result.info, ...apiCheck };
        result.details = { ...result.details, ...apiCheck };
      } catch (apiError) {
        this.logger.error(`API health check failed: ${apiError.message}`);
        result.error['upload_api'] = { 
          status: 'down', 
          message: 'API загрузки медиа недоступно'
        };
        result.details['upload_api'] = { 
          status: 'down', 
          message: 'API загрузки медиа недоступно'
        };
        result.status = 'error';
      }

      // Проверка соединения с MinIO
      try {
        const minioCheck = await this.minioIndicator.isHealthy('minio_storage');
        result.info = { ...result.info, ...minioCheck };
        result.details = { ...result.details, ...minioCheck };
      } catch (minioError) {
        this.logger.error(`MinIO health check failed: ${minioError.message}`);
        result.error['minio_storage'] = { 
          status: 'down', 
          message: minioError.message || 'MinIO недоступен'
        };
        result.details['minio_storage'] = { 
          status: 'down', 
          message: minioError.message || 'MinIO недоступен'
        };
        result.status = 'error';
      }

      return result as HealthCheckResult;
    } catch (error) {
      this.logger.error(`Overall health check failed: ${error.message}`);
      return {
        status: 'error',
        info: {},
        error: {
          system: {
            status: 'down',
            message: 'Ошибка проверки работоспособности API'
          }
        },
        details: {
          system: {
            status: 'down',
            message: 'Ошибка проверки работоспособности API'
          }
        }
      };
    }
  }
  
  @Get()
  @HealthCheck()
  async root(): Promise<HealthCheckResult> {
    return this.check();
  }
} 