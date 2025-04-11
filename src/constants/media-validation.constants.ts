import { MediaValidationOptions } from '../interfaces/media-file.interface';

export const IMAGE_VALIDATION: MediaValidationOptions = {
  maxSize: 30 * 1024 * 1024, // 30MB
  minWidth: 320,
  minHeight: 320,
  maxWidth: 4096,
  maxHeight: 4096,
  allowedMimeTypes: ['image/jpeg', 'image/png'],
};

export const VIDEO_VALIDATION: MediaValidationOptions = {
  maxSize: 650 * 1024 * 1024, // 650MB
  minWidth: 320,
  minHeight: 320,
  maxWidth: 1920,
  maxHeight: 1080,
  allowedMimeTypes: ['video/mp4', 'video/quicktime'], // mp4 и mov
  maxDuration: 60, // 60 секунд
};