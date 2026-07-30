import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsQueryDto } from './dto/events-query.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Request } from 'express';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateEventDto) {
    const userId = req.user?.id;
    return this.eventsService.createEvent(userId, dto);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get()
  async list(@Req() req: Request, @Query() query: EventsQueryDto) {
    const userId = req.user?.id;
    return this.eventsService.listEvents(userId, query);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.eventsService.getEvent(id);
  }
}
