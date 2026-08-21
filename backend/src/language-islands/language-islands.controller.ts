import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserProfile } from '../users/interfaces/user-profile.interface';
import { LanguageIslandsService } from './language-islands.service';
import { CreateLanguageIslandDto } from './dto/create-language-island.dto';
import { UpdateLanguageIslandDto } from './dto/update-language-island.dto';
import { QueryLanguageIslandsDto } from './dto/query-language-islands.dto';

@Controller('language-islands')
@UseGuards(SupabaseAuthGuard)
export class LanguageIslandsController {
  constructor(
    private readonly languageIslandsService: LanguageIslandsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: UserProfile | null,
    @Query() query: QueryLanguageIslandsDto,
  ) {
    return this.languageIslandsService.list(query, user?.id);
  }

  @Get('my')
  async getMyIslands(@CurrentUser() user: UserProfile | null) {
    if (!user) {
      return [];
    }
    return this.languageIslandsService.getMyIslands(user.id);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.languageIslandsService.getById(id);
  }

  @Post()
  async create(
    @CurrentUser() user: UserProfile,
    @Body() dto: CreateLanguageIslandDto,
  ) {
    return this.languageIslandsService.create(dto, user.id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: UserProfile,
    @Param('id') id: string,
    @Body() dto: UpdateLanguageIslandDto,
  ) {
    return this.languageIslandsService.update(id, dto, user.id);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: UserProfile, @Param('id') id: string) {
    return this.languageIslandsService.remove(id, user.id);
  }

  @Post(':id/join')
  async join(@CurrentUser() user: UserProfile, @Param('id') id: string) {
    return this.languageIslandsService.join(id, user.id);
  }

  @Post(':id/leave')
  async leave(@CurrentUser() user: UserProfile, @Param('id') id: string) {
    return this.languageIslandsService.leave(id, user.id);
  }
}
