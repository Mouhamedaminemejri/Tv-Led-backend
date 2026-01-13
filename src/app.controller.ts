import { Controller, Get, Res } from '@nestjs/common';
import { AppService } from './app.service';
import type { Response } from 'express';
import { join } from 'path';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(@Res() res: Response): void {
    // Redirect root to LED scanner
    res.redirect('/led-scanner.html');
  }

  // Serve LED scanner HTML directly (bypass API prefix)
  @Get('led-scanner.html')
  serveLedScanner(@Res() res: Response) {
    return res.sendFile(join(process.cwd(), 'public', 'led-scanner.html'));
  }
}
