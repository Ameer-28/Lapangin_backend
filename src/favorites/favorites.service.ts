import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByUser(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: {
        venue: true,
      },
    });
  }

  async add(userId: string, venueId: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) {
      throw new NotFoundException(`Venue with ID ${venueId} not found`);
    }

    return this.prisma.favorite.upsert({
      where: {
        userId_venueId: {
          userId,
          venueId,
        },
      },
      update: {},
      create: {
        userId,
        venueId,
      },
    });
  }

  async remove(userId: string, venueId: string) {
    try {
      await this.prisma.favorite.delete({
        where: {
          userId_venueId: {
            userId,
            venueId,
          },
        },
      });
      return { success: true, message: 'Removed from favorites' };
    } catch (error) {
      throw new NotFoundException(`Favorite not found`);
    }
  }

  async isFavorite(userId: string, venueId: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: {
        userId_venueId: {
          userId,
          venueId,
        },
      },
    });

    return { isFavorite: !!favorite };
  }
}
