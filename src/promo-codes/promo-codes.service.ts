import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';

@Injectable()
export class PromoCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(code: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { code },
    });

    if (!promo) {
      return { valid: false, message: 'Promo code not found' };
    }

    if (!promo.isActive) {
      return { valid: false, message: 'Promo code is inactive' };
    }

    const now = new Date();
    if (now < new Date(promo.validFrom) || now > new Date(promo.validUntil)) {
      return { valid: false, message: 'Promo code is expired or not yet valid' };
    }

    if (promo.usedCount >= promo.maxUses) {
      return { valid: false, message: 'Promo code has reached maximum uses' };
    }

    return { valid: true, discountPct: promo.discountPct, code: promo.code };
  }

  // Admin Methods
  async findAll() {
    return this.prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreatePromoCodeDto) {
    return this.prisma.promoCode.create({
      data: {
        code: dto.code,
        discountPct: dto.discountPct,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        maxUses: dto.maxUses,
      },
    });
  }

  async update(id: string, dto: Partial<CreatePromoCodeDto> & { isActive?: boolean }) {
    const existing = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Promo code with ID ${id} not found`);
    }

    const updateData: any = { ...dto };
    if (dto.validFrom) updateData.validFrom = new Date(dto.validFrom);
    if (dto.validUntil) updateData.validUntil = new Date(dto.validUntil);

    return this.prisma.promoCode.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Promo code with ID ${id} not found`);
    }

    await this.prisma.promoCode.delete({
      where: { id },
    });

    return { success: true, message: 'Promo code deleted successfully' };
  }
}
