import { 
    Controller, 
    Post, 
    UploadedFile, 
    UploadedFiles,
    UseInterceptors, 
    BadRequestException,
    ParseFilePipe,
    MaxFileSizeValidator
  } from '@nestjs/common';
  import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
  import { MediaService } from './media.service';
  import { MediaResponseDto } from '../dto/media-response.dto';
  import { BatchUploadResponseDto } from '../dto/batch-upload-response.dto';
  
  @Controller('media')
  export class MediaController {
    constructor(private readonly mediaService: MediaService) {}
  
    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
      @UploadedFile(
        new ParseFilePipe({
          validators: [
            new MaxFileSizeValidator({ maxSize: 650 * 1024 * 1024 }),
          ],
        }),
      ) file: Express.Multer.File,
    ): Promise<MediaResponseDto> {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }
      
      return this.mediaService.processAndUploadFile({
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
        size: file.size,
      });
    }
  
    @Post('upload-multiple')
    @UseInterceptors(FilesInterceptor('files', 10))
    async uploadMultipleFiles(
      @UploadedFiles() files: Express.Multer.File[],
    ): Promise<MediaResponseDto[]> {
      if (!files || files.length === 0) {
        throw new BadRequestException('No files uploaded');
      }
  
      if (files.length > 10) {
        throw new BadRequestException('Maximum 10 files can be uploaded at once');
      }
      
      const uploadPromises = files.map(file => 
        this.mediaService.processAndUploadFile({
          originalname: file.originalname,
          mimetype: file.mimetype,
          buffer: file.buffer,
          size: file.size,
        })
      );
      
      return Promise.all(uploadPromises);
    }
  
    @Post('upload-batch')
    @UseInterceptors(FilesInterceptor('files', 10))
    async uploadBatchFiles(
      @UploadedFiles() files: Express.Multer.File[],
    ): Promise<BatchUploadResponseDto> {
      if (!files || files.length === 0) {
        throw new BadRequestException('No files uploaded');
      }
  
      const results: BatchUploadResponseDto = {
        success: 0,
        failed: 0,
        files: [],
        errors: []
      };

     
      const uploadPromises = files.map(async file => {
        try {
          const result = await this.mediaService.processAndUploadFile({
            originalname: file.originalname,
            mimetype: file.mimetype,
            buffer: file.buffer,
            size: file.size,
          });
      
          results.files.push(result);
          results.success++;
          return { success: true, result };
        } catch (error) {
          results.failed++;
          results.errors.push({
            filename: file.originalname,
            error: error.message || 'Unknown error',
          });
          return { success: false, error };
        }
      });
      
  
    //   const uploadPromises = files.map(async file => {
      
    //     try {
    //       const result = await this.mediaService.processAndUploadFile({
    //         originalname: file.originalname,
    //         mimetype: file.mimetype,
    //         buffer: file.buffer,
    //         size: file.size,
    //       });
          
    //       results.files.push(result);
    //       results.success++;
    //       return { success: true, result };
    //     } catch (error) {
    //       results.failed++;
    //       (results.errors as any[]).push({
    //         filename: file.originalname,
    //         error: error.message || 'Unknown error',
    //       });
    //       return { success: false, error };
    //     }
    //   });
      
      await Promise.all(uploadPromises);
      
      if (results.success === 0 && results.failed > 0) {
        throw new BadRequestException('All files failed validation', { cause: results });
      }
      
      return results;
    }
  }