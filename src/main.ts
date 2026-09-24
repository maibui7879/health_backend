import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/response/http-exception.filter';
import { LoggingInterceptor } from './common/logging/logging.interceptor';
import { TransformResponseInterceptor } from './common/response/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalInterceptors(
    new TransformResponseInterceptor(),
    new LoggingInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('BeroHealth API')
    .setDescription('API cho ứng dụng sức khỏe và thể chất BeroHealth')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, swaggerDocument);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  new Logger('Bootstrap').log(`Swagger URL: http://localhost:${port}/api`);
}
void bootstrap();
