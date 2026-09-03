import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';

@Injectable()
export class CourtsService {
  constructor(private prisma: PrismaService) {}

  async create(venueId: string, dto: CreateCourtDto) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
    });
    if (!venue) {
      throw new NotFoundException(`Venue dengan ID ${venueId} tidak ditemukan`);
    }

    return this.prisma.court.create({
      data: {
        venueId,
        name: dto.name,
        courtType: dto.courtType || (venue.type === 'Outdoor' ? 'Rumput Sintetis' : 'Vinyl'),
        description: dto.description,
        pricePerHour: dto.pricePerHour ?? null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async findAllByVenue(venueId: string, includeInactive: boolean = false) {
    const where: any = { venueId };
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.court.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const court = await this.prisma.court.findUnique({
      where: { id },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            city: true,
            type: true,
            pricePerHour: true,
          },
        },
      },
    });

    if (!court) {
      throw new NotFoundException(`Lapangan dengan ID ${id} tidak ditemukan`);
    }

    return court;
  }

  async update(id: string, dto: UpdateCourtDto) {
    await this.findOne(id);

    return this.prisma.court.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.courtType !== undefined && { courtType: dto.courtType }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.pricePerHour !== undefined && { pricePerHour: dto.pricePerHour }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async toggleStatus(id: string) {
    const court = await this.findOne(id);
    return this.prisma.court.update({
      where: { id },
      data: { isActive: !court.isActive },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeBookingsCount = await this.prisma.booking.count({
      where: {
        courtId: id,
        status: { in: ['upcoming', 'pending_payment'] },
        date: { gte: today },
      },
    });

    if (activeBookingsCount > 0) {
      throw new BadRequestException(
        `Lapangan tidak dapat dihapus karena masih memiliki ${activeBookingsCount} pesanan aktif. Silakan nonaktifkan status lapangan terlebih dahulu.`
      );
    }

    return this.prisma.court.delete({
      where: { id },
    });
  }
}
