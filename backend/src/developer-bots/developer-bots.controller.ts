import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RequireVip } from '../monetisation/decorators/require-vip.decorator';
import { VipGuard } from '../monetisation/guards/vip.guard';
import { DeveloperBotsService } from './developer-bots.service';
import { CreateDeveloperBotDto } from './dto/create-developer-bot.dto';
import { UpdateDeveloperBotDto } from './dto/update-developer-bot.dto';
import { CustomEducationalBotRow } from './interfaces/custom-bot.interface';

@ApiTags('Developer Bots')
@ApiBearerAuth()
@Controller('developer-bots')
@UseGuards(SupabaseAuthGuard, VipGuard)
@RequireVip('developer')
export class DeveloperBotsController {
  constructor(private readonly developerBotsService: DeveloperBotsService) {}

  @Get()
  @ApiOperation({ summary: 'List the caller custom educational bots' })
  list(@CurrentUser() user: User | null): Promise<CustomEducationalBotRow[]> {
    if (!user) throw new UnauthorizedException();
    return this.developerBotsService.listBots(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom educational bot' })
  create(
    @CurrentUser() user: User | null,
    @Body() dto: CreateDeveloperBotDto,
  ): Promise<CustomEducationalBotRow> {
    if (!user) throw new UnauthorizedException();
    return this.developerBotsService.createBot(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update one of the caller custom educational bots' })
  update(
    @CurrentUser() user: User | null,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDeveloperBotDto,
  ): Promise<CustomEducationalBotRow> {
    if (!user) throw new UnauthorizedException();
    return this.developerBotsService.updateBot(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one of the caller custom educational bots' })
  remove(
    @CurrentUser() user: User | null,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    if (!user) throw new UnauthorizedException();
    return this.developerBotsService.deleteBot(id, user.id);
  }
}
