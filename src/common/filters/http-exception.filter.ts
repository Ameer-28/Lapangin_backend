import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message || message;
        error = resObj.error || error;
      }
    } else if (typeof exception === 'object' && exception !== null) {
      const err = exception as any;
      // Handle Prisma Known Request Errors gracefully
      if (err.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Data yang dimasukkan bertabrakan dengan data yang sudah ada (duplikat).';
        error = 'Conflict';
      } else if (err.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Data yang diminta tidak ditemukan.';
        error = 'Not Found';
      } else {
        // Unexpected server-side errors
        this.logger.error(
          `Unhandled Exception: ${err.message || 'Unknown error'}`,
          err.stack,
        );
        message = 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.';
      }
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error,
    };

    response.status(status).json(errorResponse);
  }
}
