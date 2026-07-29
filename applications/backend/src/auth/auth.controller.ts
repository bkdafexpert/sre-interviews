import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AUTH_COOKIE, JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, AuthUser } from './current-user.decorator';

class GoogleLoginDto {
  @ApiPropertyOptional({ description: 'Profile email; defaults to the seeded demo user when omitted' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Display name; defaults to the seeded demo user when omitted' })
  @IsOptional()
  @IsString()
  name?: string;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Stands in for the Google OAuth callback — see AuthService for the rationale.
  @ApiOperation({ summary: 'Sign in (demo Google stand-in) and set the httpOnly session cookie' })
  @Post('google')
  async google(@Body() dto: GoogleLoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.signIn(dto);
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: WEEK_MS,
      path: '/',
    });
    return { user };
  }

  @ApiOperation({ summary: 'Return the currently authenticated user' })
  @ApiBearerAuth()
  @ApiCookieAuth('sgcut_token')
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    const found = await this.auth.userById(user.id);
    if (!found) throw new UnauthorizedException('Session user no longer exists');
    return { user: found };
  }

  @ApiOperation({ summary: 'Clear the session cookie (sign out)' })
  @Post('logout')
  async logout(@Req() _req: Request, @Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  }
}
