import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingCategory } from '@prisma/client';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const settings = await this.prisma.setting.findMany();
    const grouped = settings.reduce<Record<string, any[]>>((acc, setting) => {
      if (!acc[setting.category]) acc[setting.category] = [];
      acc[setting.category].push(setting);
      return acc;
    }, {});
    return grouped;
  }

  async findByCategory(category: string) {
    return this.prisma.setting.findMany({
      where: { category: category as SettingCategory },
    });
  }

  async bulkUpdate(dto: UpdateSettingsDto, userId: string) {
    const updates = dto.settings.map(s => 
      this.prisma.setting.update({
        where: { key: s.key },
        data: { value: s.value, updatedById: userId },
      })
    );
    await this.prisma.$transaction(updates);
    return { success: true, message: 'Settings updated successfully' };
  }

  async getValue(key: string) {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    return setting?.value;
  }
}
