import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ResourceLibraryService } from './resource-library.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('resource-library')
@UseGuards(SupabaseAuthGuard)
export class ResourceLibraryController {
  constructor(private readonly resourceService: ResourceLibraryService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateResourceDto) {
    return this.resourceService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.resourceService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resourceService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.resourceService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.resourceService.remove(id);
  }
}
