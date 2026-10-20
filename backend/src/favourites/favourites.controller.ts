import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AddFavouriteDto } from '../chat/dto/add-favourite.dto';
import { FavouritesService } from './favourites.service';

interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('favourites')
@UseGuards(SupabaseAuthGuard)
export class FavouritesController {
  constructor(private readonly favouritesService: FavouritesService) {}

  @Post()
  async addFavourite(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AddFavouriteDto,
  ): Promise<unknown> {
    return this.favouritesService.addFavourite(req.user.id, dto);
  }

  @Delete(':id')
  async removeFavourite(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.favouritesService.removeFavourite(req.user.id, id);
  }

  @Get()
  async getMyFavourites(@Req() req: AuthenticatedRequest) {
    return this.favouritesService.getUserFavourites(req.user.id);
  }

  /**
   * Compatibility route for older clients. Never allow the URL parameter to
   * widen the authenticated user's read scope.
   */
  @Get('user/:userId')
  async getUserFavourites(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    if (req.user.id !== userId) {
      throw new ForbiddenException('You can only read your own favourites');
    }
    return this.favouritesService.getUserFavourites(req.user.id);
  }
}
