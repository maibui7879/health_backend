import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/response/http-exception.filter';
import { LoggingInterceptor } from './common/logging/logging.interceptor';
import { TransformResponseInterceptor } from './common/response/response.interceptor';
import { localeMiddleware } from './i18n/locale.middleware';
import { LocalizationService } from './i18n/localization.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // Locale sớm nhất có thể: ValidationPipe cũng thấy locale từ header.
  app.use(localeMiddleware);
  const i18n = app.get(LocalizationService);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalInterceptors(
    new TransformResponseInterceptor(i18n),
    new LoggingInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter(i18n));

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
