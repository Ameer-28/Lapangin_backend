import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('process')
  @ApiOperation({ summary: 'Process a payment for a booking' })
  processPayment(
    @CurrentUser() user: any,
    @Body() processPaymentDto: ProcessPaymentDto,
  ) {
    return this.paymentsService.processPayment(user.sub, processPaymentDto);
  }

  @Get(':bookingId')
  @ApiOperation({ summary: 'Get payment status of a booking' })
  getPaymentStatus(@Param('bookingId') bookingId: string) {
    return this.paymentsService.getPaymentStatus(bookingId);
  }
}
