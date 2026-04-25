import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  // 2. Enable CORS (for admin web app and mobile app)
  app.enableCors({
    origin: '*', // tighten this in production
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 3. Global validation pipe — enforces all DTOs automatically
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // strips unknown fields from requests
      forbidNonWhitelisted: true,
      transform: true,        // auto-transforms payloads to DTO class instances
    }),
  );

  // 4. Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('RentFinda Uganda API')
    .setDescription('Backend API for the RentFinda property rental platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 RentFinda API running on: http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger docs at:          http://localhost:${port}/api/docs`);
}

bootstrap();