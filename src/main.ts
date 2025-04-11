import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors(); // Включаем CORS для доступа с фронтенда
  await app.listen(4003);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();