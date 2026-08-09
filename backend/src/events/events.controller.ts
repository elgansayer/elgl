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
  UnauthorizedException,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsQueryDto } from './dto/events-query.dto';
import { RsvpDto } from './dto/rsvp.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateEventDto) {
    if (!req.user) throw new UnauthorizedException();
    const userId = req.user.id;
    return this.eventsService.createEvent(userId, dto);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query() query: EventsQueryDto) {
    if (!req.user) throw new UnauthorizedException();
    const userId = req.user.id;
    return this.eventsService.listEvents(userId, {
      ...query,
      proficiency: query.proficiency,
    });
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('categories')
  getCategories() {
    return this.eventsService.getCategories();
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('my')
  async getMyEvents(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
  ) {
    if (!req.user) throw new UnauthorizedException();
    const userId = req.user.id;
    return this.eventsService.getUserEvents(userId, status as any);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.eventsService.getEvent(id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get(':id/rsvp')
  async getMyRsvp(
    @Req() req: AuthenticatedRequest,
    @Param('id') eventId: string,
  ) {
    if (!req.user) throw new UnauthorizedException();
    const userId = req.user.id;
    return this.eventsService.getUserRsvp(userId, eventId);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post(':id/rsvp')
  async rsvp(
    @Req() req: AuthenticatedRequest,
    @Param('id') eventId: string,
    @Body() dto: RsvpDto,
  ) {
    if (!req.user) throw new UnauthorizedException();
    const userId = req.user.id;
    return this.eventsService.createRsvp(userId, eventId, dto.status);
  }

  @UseGuards(SupabaseAuthGuard)
  @Delete(':id/rsvp')
  async removeRsvp(
    @Req() req: AuthenticatedRequest,
    @Param('id') eventId: string,
  ) {
    if (!req.user) throw new UnauthorizedException();
    const userId = req.user.id;
    return this.eventsService.removeRsvp(userId, eventId);
  }
}
