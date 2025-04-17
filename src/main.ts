import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const app = await NestFactory.create(AppModule);
    
    // Глобальная валидация входящих данных
    app.useGlobalPipes(new ValidationPipe());
    
    // Включаем CORS для доступа с фронтенда
    app.enableCors();
    
    const port = process.env.PORT || 4003;
    await app.listen(port, '0.0.0.0');
    
    logger.log(`Приложение запущено на http://0.0.0.0:${port}`);
    logger.log(`Статус сервера доступен по адресу:`);
    logger.log(`- http://0.0.0.0:${port} (корневой адрес)`);
    logger.log(`- http://0.0.0.0:${port}/health`);
  } catch (error) {
    logger.error(`Ошибка при запуске приложения: ${error.message}`, error.stack);
    process.exit(1);
  }
}

bootstrap().catch(err => {
  console.error('Критическая ошибка при запуске приложения:', err);
  process.exit(1);
});