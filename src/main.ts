import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for Frontend (before other middleware)
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Token', 'x-guest-token'],
  });

  // Serve static HTML files from public directory FIRST (before API prefix)
  // This allows direct access to /led-scanner.html
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/',
    index: false,
  });

  // Serve static files from uploads directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Best Practices
  app.setGlobalPrefix('api');
  app.use(compression());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true
  }));

  const port = process.env.PORT ?? 3001;
  // Listen on all network interfaces (0.0.0.0) to allow access from other devices
  await app.listen(port, '0.0.0.0');
  
  console.log(`\n🚀 Server running on http://localhost:${port}`);
  console.log(`🌐 Network access: http://192.168.100.20:${port}`);
  console.log(`📁 Uploads served from: ${join(process.cwd(), 'uploads')}`);
  console.log(`📱 LED Scanner: http://192.168.100.20:${port}/led-scanner.html`);
  console.log(`🧪 Test page: http://192.168.100.20:${port}/test.html\n`);
  console.log(`⚠️  If phone can't connect:`);
  console.log(`   1. Check Windows Firewall allows port ${port}`);
  console.log(`   2. Verify both devices on same WiFi`);
  console.log(`   3. Try: netsh advfirewall firewall add rule name="Node Port ${port}" dir=in action=allow protocol=TCP localport=${port}\n`);
}
bootstrap();

