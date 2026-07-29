import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

// Current API version. Resource endpoints live under /api/v1; ops endpoints (health) stay unversioned.
export const API_VERSION = 'v1';

@ApiTags('ops')
@Controller('api')
export class AppController {
  // Reachable at /api/health (unversioned). Used by the Docker healthcheck.
  @ApiOperation({ summary: 'Liveness/health probe used by the Docker healthcheck' })
  @Get('health')
  health() {
    return { status: 'ok', service: 'sgcut-api', version: API_VERSION };
  }

  // Reports the API version and the versioned base path.
  @ApiOperation({ summary: 'Report the API version and versioned base path' })
  @Get('version')
  version() {
    return { version: API_VERSION, basePath: `/api/${API_VERSION}` };
  }
}
