import { MediaResponseDto } from './media-response.dto';

export class BatchUploadResponseDto {
  success: number;
  failed: number;
  files: MediaResponseDto[];
  errors: { filename: string; error: string }[];
}