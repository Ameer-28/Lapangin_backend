import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';

@Injectable()
export class PricingRulesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async create(venueId: string, dto: CreatePricingRuleDto) {
    // Validate venue exists
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue tidak ditemukan');

    // Validate time range
    const startH = parseInt(dto.startTime.split(':')[0], 10);
    const endH = parseInt(dto.endTime.split(':')[0], 10);
    if (endH <= startH) {
      throw new BadRequestException('Jam akhir harus lebih besar dari jam mulai');
    }

    // Validate court if specified
    if (dto.courtId) {
      const court = await this.prisma.court.findUnique({ where: { id: dto.courtId } });
      if (!court || court.venueId !== venueId) {
        throw new BadRequestException('Lapangan tidak ditemukan di venue ini');
      }
    }

    return this.prisma.pricingRule.create({
      data: {
        venueId,
        courtId: dto.courtId || null,
        name: dto.name,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        pricePerHour: dto.pricePerHour,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: {
        court: { select: { id: true, name: true } },
      },
    });
  }

  async findAllByVenue(venueId: string) {
    return this.prisma.pricingRule.findMany({
      where: { venueId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        court: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.pricingRule.findUnique({
      where: { id },
      include: {
        court: { select: { id: true, name: true } },
      },
    });
    if (!rule) throw new NotFoundException('Pricing rule tidak ditemukan');
    return rule;
  }

  async update(id: string, dto: UpdatePricingRuleDto) {
    const rule = await this.prisma.pricingRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Pricing rule tidak ditemukan');

    if (dto.startTime && dto.endTime) {
      const startH = parseInt(dto.startTime.split(':')[0], 10);
      const endH = parseInt(dto.endTime.split(':')[0], 10);
      if (endH <= startH) {
        throw new BadRequestException('Jam akhir harus lebih besar dari jam mulai');
      }
    }

    if (dto.courtId) {
      const court = await this.prisma.court.findUnique({ where: { id: dto.courtId } });
      if (!court || court.venueId !== rule.venueId) {
        throw new BadRequestException('Lapangan tidak ditemukan di venue ini');
      }
    }

    return this.prisma.pricingRule.update({
      where: { id },
      data: {
        name: dto.name,
        courtId: dto.courtId !== undefined ? (dto.courtId || null) : undefined,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        pricePerHour: dto.pricePerHour,
        priority: dto.priority,
        isActive: dto.isActive,
      },
      include: {
        court: { select: { id: true, name: true } },
      },
    });
  }

  async toggleStatus(id: string) {
    const rule = await this.prisma.pricingRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Pricing rule tidak ditemukan');

    return this.prisma.pricingRule.update({
      where: { id },
      data: { isActive: !rule.isActive },
      include: {
        court: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    const rule = await this.prisma.pricingRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Pricing rule tidak ditemukan');

    return this.prisma.pricingRule.delete({ where: { id } });
  }

  // ─── PRICE RESOLUTION ENGINE ───────────────────────────────────────────────

  /**
   * Resolves the effective hourly price for a specific slot.
   * 
   * Algorithm:
   * 1. Fetch all active PricingRule records for the venue.
   * 2. Filter rules matching: dayOfWeek includes the date's day (or is empty),
   *    AND the slot's startTime falls within [rule.startTime, rule.endTime).
   * 3. Among matching rules: prefer court-scoped rules over venue-wide rules,
   *    then pick the highest priority.
   * 4. If no rule matches, return court.pricePerHour ?? venue.pricePerHour.
   */
  async resolveSlotPrice(
    venueId: string,
    courtId: string | null,
    date: Date,
    startTime: string,
    basePrice: number,
    cachedRules?: any[],
  ): Promise<{ price: number; ruleName: string | null; ruleId: string | null }> {
    // Use cached rules if provided (for batch slot resolution in a single booking)
    const rules = cachedRules ?? await this.prisma.pricingRule.findMany({
      where: { venueId, isActive: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const slotHour = parseInt(startTime.split(':')[0], 10);
    const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat

    // Filter matching rules
    const matching = rules.filter(rule => {
      // Day check: empty array = all days
      if (rule.dayOfWeek.length > 0 && !rule.dayOfWeek.includes(dayOfWeek)) {
        return false;
      }

      // Time range check: slotHour must be within [startTime, endTime)
      const ruleStartH = parseInt(rule.startTime.split(':')[0], 10);
      const ruleEndH = parseInt(rule.endTime.split(':')[0], 10);
      if (slotHour < ruleStartH || slotHour >= ruleEndH) {
        return false;
      }

      return true;
    });

    if (matching.length === 0) {
      return { price: basePrice, ruleName: null, ruleId: null };
    }

    // Sort: court-scoped rules first, then by priority desc
    matching.sort((a, b) => {
      // Court-scoped rules that match this court take highest precedence
      const aCourtMatch = a.courtId && a.courtId === courtId ? 1 : 0;
      const bCourtMatch = b.courtId && b.courtId === courtId ? 1 : 0;
      if (aCourtMatch !== bCourtMatch) return bCourtMatch - aCourtMatch;

      // Filter out court-scoped rules for OTHER courts
      // (they shouldn't apply to this court)
      return b.priority - a.priority;
    });

    // Pick the best match, but skip rules scoped to a different court
    for (const rule of matching) {
      if (rule.courtId && rule.courtId !== courtId) {
        continue; // This rule is for a different court
      }
      return {
        price: rule.pricePerHour,
        ruleName: rule.name,
        ruleId: rule.id,
      };
    }

    // No applicable rules after filtering
    return { price: basePrice, ruleName: null, ruleId: null };
  }

  /**
   * Batch resolve prices for multiple slots (performance optimization).
   * Fetches rules once and resolves all slots.
   */
  async resolveMultiSlotPrices(
    venueId: string,
    courtId: string | null,
    date: Date,
    startTimes: string[],
    basePrice: number,
  ): Promise<{ time: string; price: number; ruleName: string | null }[]> {
    const rules = await this.prisma.pricingRule.findMany({
      where: { venueId, isActive: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const results: { time: string; price: number; ruleName: string | null }[] = [];
    for (const time of startTimes) {
      const resolved = await this.resolveSlotPrice(venueId, courtId, date, time, basePrice, rules);
      results.push({ time, price: resolved.price, ruleName: resolved.ruleName });
    }
    return results;
  }
}
