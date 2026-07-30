import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsQueryDto } from './dto/events-query.dto';
import { RsvpDto } from './dto/rsvp.dto';
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
  @Get('categories')
  async getCategories() {
    return this.eventsService.getCategories();
  }

  @UseGuards(SupabaseAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.eventsService.getEvent(id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get(':id/rsvp')
  async getMyRsvp(@Req() req: Request, @Param('id') eventId: string) {
    const userId = req.user?.id;
    return this.eventsService.getUserRsvp(userId, eventId);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post(':id/rsvp')
  async rsvp(
    @Req() req: Request,
    @Param('id') eventId: string,
    @Body() dto: RsvpDto,
  ) {
    const userId = req.user?.id;
    return this.eventsService.createRsvp(userId, eventId, dto.status);
  }

  @UseGuards(SupabaseAuthGuard)
  @Delete(':id/rsvp')
  async removeRsvp(@Req() req: Request, @Param('id') eventId: string) {
    const userId = req.user?.id;
    return this.eventsService.removeRsvp(userId, eventId);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('my')
  async getMyEvents(@Req() req: Request, @Query('status') status?: string) {
    const userId = req.user?.id;
    return this.eventsService.getUserEvents(userId, status as any);
  }
}
