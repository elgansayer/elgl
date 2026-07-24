import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FavouritesService } from './favourites.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('favourites')
@UseGuards(SupabaseAuthGuard)
export class FavouritesController {
  constructor(private readonly favouritesService: FavouritesService) {}

  @Post()
  async addFavourite(
    @Req() req: { user: { id: string } },
    @Body() dto: { message_id: string; note_text?: string },
  ): Promise<unknown> {
    return this.favouritesService.addFavourite(req.user.id, dto);
  }

  @Delete(':id')
  async removeFavourite(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.favouritesService.removeFavourite(req.user.id, id);
  }

  @Get('user/:userId')
  async getUserFavourites(@Param('userId') userId: string) {
    return this.favouritesService.getUserFavourites(userId);
  }
}
