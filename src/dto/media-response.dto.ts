import { MediaType } from '../interfaces/media-file.interface';

export class MediaResponseDto {
  url: string;
  type: MediaType;
  filename: string;
  size: number;
  width?: number;
  height?: number;
}