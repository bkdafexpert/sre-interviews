import { Controller, Get, Header, Param, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { RedirectService } from './redirect.service';

@ApiTags('redirect')
@Controller()
export class RedirectController {
  constructor(private readonly redirect: RedirectService) {}

  @ApiOperation({ summary: 'Landing text served at the site root' })
  @Get()
  @Header('content-type', 'text/plain; charset=utf-8')
  root() {
    return 'Sgcut — raccourcisseur d’URL. Les liens courts ont la forme /<code>.';
  }

  // Served at the root (excluded from the /api prefix) so a short URL reads sgcut.co/<code>.
  @ApiOperation({ summary: 'Resolve a short code, record the click and 302-redirect to the destination' })
  @Get(':code')
  async go(@Param('code') code: string, @Req() req: Request, @Res() res: Response) {
    const destination = await this.redirect.resolve(code, {
      referer: req.get('referer') ?? undefined,
      userAgent: req.get('user-agent') ?? undefined,
      countryCode: (req.get('cf-ipcountry') || req.get('x-country')) ?? undefined,
    });
    res.redirect(302, destination);
  }
}
