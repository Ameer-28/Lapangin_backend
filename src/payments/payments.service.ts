import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async processPayment(userId: string, dto: ProcessPaymentDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${dto.bookingId} not found`);
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('You are not allowed to pay for this booking');
    }

    if (booking.status !== 'upcoming') {
      throw new BadRequestException('Booking is not in upcoming status, cannot process payment');
    }

    if (booking.paidAt) {
      throw new BadRequestException('Booking is already paid');
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id: dto.bookingId },
      data: {
        paymentMethod: dto.paymentMethod,
        paymentDetail: dto.paymentDetail,
        paidAt: new Date(),
      },
    });

    return updatedBooking;
  }

  async getPaymentStatus(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        paidAt: true,
        paymentMethod: true,
        paymentDetail: true,
        total: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    return booking;
  }
}
