export interface MediaFile {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  }
  
  export enum MediaType {
    IMAGE = 'image',
    VIDEO = 'video',
    UNKNOWN = 'unknown',
  }
  
  export interface MediaValidationOptions {
    maxSize: number;
    minWidth: number;
    minHeight: number;
    maxWidth?: number;
    maxHeight?: number;
    allowedMimeTypes: string[];
    maxDuration?: number; // в секундах
  }