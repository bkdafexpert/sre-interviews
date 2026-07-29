import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { LinksService } from './links.service';
import { CreateLinkDto, ListLinksDto, UpdateLinkDto } from './dto';

@ApiTags('links')
@ApiBearerAuth()
@ApiCookieAuth('sgcut_token')
@Controller('api/v1/links')
@UseGuards(JwtAuthGuard)
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @ApiOperation({ summary: 'Create a short link for the current user' })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLinkDto) {
    return this.links.create(user.id, dto.destination, dto.expiresInDays ?? null);
  }

  @ApiOperation({ summary: 'List the current user’s links (search / filter / paginate)' })
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListLinksDto) {
    return this.links.list(user.id, query);
  }

  // Declared before ':code' so it isn't captured as a short code.
  @ApiOperation({ summary: 'Aggregate link/click stats for the current user' })
  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.links.stats(user.id);
  }

  @ApiOperation({ summary: 'Get one link with its analytics detail' })
  @Get(':code')
  detail(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.links.detail(user.id, code);
  }

  // Activate / deactivate a link.
  @ApiOperation({ summary: 'Activate or deactivate a link' })
  @Patch(':code')
  update(@CurrentUser() user: AuthUser, @Param('code') code: string, @Body() dto: UpdateLinkDto) {
    return this.links.setActive(user.id, code, dto.active);
  }

  @ApiOperation({ summary: 'Delete a link (its click events cascade)' })
  @Delete(':code')
  remove(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.links.remove(user.id, code);
  }
}
