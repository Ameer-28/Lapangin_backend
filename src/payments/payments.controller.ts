import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateSnapTokenDto } from './dto/create-snap-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-snap-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Midtrans Snap token for a booking' })
  createSnapToken(
    @CurrentUser() user: any,
    @Body() dto: CreateSnapTokenDto,
  ) {
    return this.paymentsService.createSnapToken(user.sub, dto);
  }

  @Post('notification')
  @ApiOperation({ summary: 'Midtrans webhook notification handler (public)' })
  handleNotification(@Body() body: any) {
    return this.paymentsService.handleNotification(body);
  }

  @Get(':bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment status of a booking' })
  getPaymentStatus(@Param('bookingId') bookingId: string) {
    return this.paymentsService.getPaymentStatus(bookingId);
  }
}
