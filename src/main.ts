import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Increase body size limit for base64 uploads
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://lapangin-frontend.vercel.app',
    ...(process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean) || []),
  ];
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Lapang.in API')
    .setDescription('Futsal Field Booking Platform - REST API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User profile management')
    .addTag('Venues', 'Venue browsing & details')
    .addTag('Bookings', 'Booking management')
    .addTag('Payments', 'Payment processing')
    .addTag('Favorites', 'Favorite venues')
    .addTag('Reviews', 'Venue reviews')
    .addTag('Promo Codes', 'Promo code validation')
    .addTag('Admin - Users', 'Admin user management')
    .addTag('Admin - Venues', 'Admin venue management')
    .addTag('Admin - Bookings', 'Admin booking management')
    .addTag('Admin - Reports', 'Admin reports & analytics')
    .addTag('Admin - Settings', 'Admin system settings')
    .addTag('Admin - Promo Codes', 'Admin promo code management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Lapang.in API is running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
