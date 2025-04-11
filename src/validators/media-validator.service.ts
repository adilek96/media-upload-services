import { Injectable, BadRequestException } from '@nestjs/common';
import * as sharp from 'sharp';
import * as ffmpeg from 'fluent-ffmpeg';
import { MediaFile, MediaType, MediaValidationOptions } from '../interfaces/media-file.interface';
import { IMAGE_VALIDATION, VIDEO_VALIDATION } from '../constants/media-validation.constants';
import { promisify } from 'util';
import * as FileType from 'file-type';

@Injectable()
export class MediaValidatorService {
  async validateFile(file: MediaFile): Promise<{ type: MediaType; dimensions?: { width: number; height: number } }> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Файл пуст или поврежден');
    }

    // Проверка типа файла
    const fileTypeResult = await FileType.fromBuffer(file.buffer);
    if (!fileTypeResult) {
      throw new BadRequestException('Невозможно определить тип файла');
    }

    const actualMimeType = fileTypeResult.mime;
    let mediaType: MediaType;

    // Проверяем, что MIME-тип соответствует заявленному
    if (actualMimeType !== file.mimetype) {
      throw new BadRequestException('Тип файла не соответствует расширению');
    }

    // Определяем тип медиа и выбираем соответствующие правила валидации
    if (actualMimeType.startsWith('image/')) {
      mediaType = MediaType.IMAGE;
      return this.validateImage(file, IMAGE_VALIDATION);
    } else if (actualMimeType.startsWith('video/')) {
      mediaType = MediaType.VIDEO;
      return this.validateVideo(file, VIDEO_VALIDATION);
    } else {
      throw new BadRequestException('Неподдерживаемый тип файла');
    }
  }

  private async validateImage(file: MediaFile, options: MediaValidationOptions): Promise<{ type: MediaType; dimensions: { width: number; height: number } }> {
    // Проверка размера файла
    if (file.size > options.maxSize) {
      throw new BadRequestException(`Размер изображения превышает максимально допустимый (${options.maxSize / (1024 * 1024)}MB)`);
    }

    // Проверка формата
    if (!options.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Неподдерживаемый формат изображения. Допустимые форматы: ${options.allowedMimeTypes.join(', ')}`);
    }

    try {
      // Получение размеров изображения
      const metadata = await sharp(file.buffer).metadata();
      const width = metadata.width;
      const height = metadata.height;

      if (!width || !height) {
        throw new BadRequestException('Невозможно определить размеры изображения');
      }

      // Проверка минимальных размеров
      if (width < options.minWidth || height < options.minHeight) {
        throw new BadRequestException(`Изображение слишком маленькое. Минимальные размеры: ${options.minWidth}x${options.minHeight}`);
      }

      return { type: MediaType.IMAGE, dimensions: { width, height } };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Ошибка при обработке изображения');
    }
  }

  private async validateVideo(file: MediaFile, options: MediaValidationOptions): Promise<{ type: MediaType; dimensions?: { width: number; height: number } }> {
    // Проверка размера файла
    if (file.size > options.maxSize) {
      throw new BadRequestException(`Размер видео превышает максимально допустимый (${options.maxSize / (1024 * 1024)}MB)`);
    }

    // Проверка формата
    if (!options.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Неподдерживаемый формат видео. Допустимые форматы: ${options.allowedMimeTypes.join(', ')}`);
    }

    // Временно сохраняем файл для проверки ffmpeg
    const tempFilePath = `/tmp/${Date.now()}-${file.originalname}`;
    const fs = require('fs');
    const writeFile = promisify(fs.writeFile);
    const unlink = promisify(fs.unlink);

    try {
      await writeFile(tempFilePath, file.buffer);

      // Проверка длительности и разрешения видео
      const getVideoInfo = (path): Promise<{ duration: number; width: number; height: number }> => {
        return new Promise((resolve, reject) => {
          ffmpeg.ffprobe(path, (err, info) => {
            if (err) {
              return reject(err);
            }

            const videoStream = info.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
              return reject(new Error('Видеопоток не найден'));
            }

            resolve({
              duration: info.format.duration,
              width: videoStream.width,
              height: videoStream.height,
            });
          });
        });
      };

      const videoInfo = await getVideoInfo(tempFilePath);

      // Проверка длительности
      if (options.maxDuration && videoInfo.duration > options.maxDuration) {
        throw new BadRequestException(`Продолжительность видео превышает максимально допустимую (${options.maxDuration} секунд)`);
      }

      // Проверка размеров видео
      if (videoInfo.width < options.minWidth || videoInfo.height < options.minHeight) {
        throw new BadRequestException(`Разрешение видео слишком маленькое. Минимальное разрешение: ${options.minWidth}x${options.minHeight}`);
      }

      // Проверка максимального разрешения
      if (options.maxWidth && videoInfo.width > options.maxWidth || options.maxHeight && videoInfo.height > options.maxHeight) {
        throw new BadRequestException(`Разрешение видео слишком большое. Максимальное разрешение: ${options.maxWidth}x${options.maxHeight}`);
      }

      // Проверка соотношения сторон (как в Instagram)
      const aspectRatio = videoInfo.width / videoInfo.height;
      if (aspectRatio < 0.8 || aspectRatio > 1.91) { // от 4:5 до 16:9 (примерно 0.8 до 1.91)
        throw new BadRequestException('Соотношение сторон видео должно быть от 4:5 до 16:9');
      }

      return { type: MediaType.VIDEO, dimensions: { width: videoInfo.width, height: videoInfo.height } };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Ошибка при обработке видео');
    } finally {
      // Удаляем временный файл
      try {
        await unlink(tempFilePath);
      } catch (e) {
        // Игнорируем ошибки при удалении временного файла
      }
    }
  }
}