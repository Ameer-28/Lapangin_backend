import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { json, urlencoded } from 'express';

let app: any;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create(AppModule);
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));
    app.setGlobalPrefix('api');
    app.enableCors({
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  }
  return app;
}

export default async function handler(req: any, res: any) {
  const instance = await bootstrap();
  const expressApp = instance.getHttpAdapter().getInstance();
  return expressApp(req, res);
}
