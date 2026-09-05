import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  ArgumentsHost,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpException,
  Module,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class JsonErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : typeof exception === 'object' && exception && 'status' in exception
          ? Number((exception as { status: number }).status) || 500
          : 500;
    const message =
      exception instanceof Error ? exception.message : 'internal error';
    res.status(status).json({ error: message });
  }
}

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { ok: true, service: process.env.SERVICE_NAME ?? 'orarepot-node' };
  }
}

@Module({ controllers: [HealthController] })
class HealthModule {}

export async function bootstrap(module: unknown, portEnv = 'PORT', fallback = 3000) {
  const app = await NestFactory.create(module as never, { cors: true });
  app.useGlobalFilters(new JsonErrorFilter());
  const port = Number(process.env[portEnv] ?? fallback);
  await app.listen(port, '0.0.0.0');
  console.log(`${process.env.SERVICE_NAME ?? 'service'} on ${port}`);
}

export { HealthModule };
