import { PrismaClient, SettingCategory, VenueType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Start seeding...');

  // ─── Admin user ──────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@lapangin.com' },
    update: {},
    create: {
      email: 'admin@lapangin.com',
      passwordHash: adminPassword,
      fullName: 'Super Admin',
      role: 'admin',
      status: 'active',
    },
  });
  console.log('✅ Admin user created');

  // ─── Regular users ───────────────────────────────────────────────────────────
  const userPassword = await bcrypt.hash('password123', 10);

  const rizki = await prisma.user.upsert({
    where: { email: 'rizki@email.com' },
    update: {},
    create: {
      email: 'rizki@email.com',
      passwordHash: userPassword,
      fullName: 'Rizki Pratama',
      phone: '081234567890',
      city: 'Jakarta',
      role: 'user',
      status: 'active',
    },
  });

  const siti = await prisma.user.upsert({
    where: { email: 'siti@email.com' },
    update: {},
    create: {
      email: 'siti@email.com',
      passwordHash: userPassword,
      fullName: 'Siti Nurhaliza',
      phone: '081234567891',
      city: 'Bandung',
      role: 'user',
      status: 'active',
    },
  });

  const budi = await prisma.user.upsert({
    where: { email: 'budi@email.com' },
    update: {},
    create: {
      email: 'budi@email.com',
      passwordHash: userPassword,
      fullName: 'Budi Santoso',
      phone: '081234567892',
      city: 'Surabaya',
      role: 'user',
      status: 'active',
    },
  });

  const andi = await prisma.user.upsert({
    where: { email: 'andi@email.com' },
    update: {},
    create: {
      email: 'andi@email.com',
      passwordHash: userPassword,
      fullName: 'Andi Wijaya',
      phone: '081234567893',
      city: 'Jakarta',
      role: 'user',
      status: 'active',
    },
  });

  const maya = await prisma.user.upsert({
    where: { email: 'maya@email.com' },
    update: {},
    create: {
      email: 'maya@email.com',
      passwordHash: userPassword,
      fullName: 'Maya Putri',
      phone: '081234567894',
      city: 'Yogyakarta',
      role: 'user',
      status: 'active',
    },
  });

  const dian = await prisma.user.upsert({
    where: { email: 'dian@email.com' },
    update: {},
    create: {
      email: 'dian@email.com',
      passwordHash: userPassword,
      fullName: 'Dian Saputra',
      phone: '081234567895',
      city: 'Bekasi',
      role: 'user',
      status: 'suspended',
    },
  });

  const fajar = await prisma.user.upsert({
    where: { email: 'fajar@email.com' },
    update: {},
    create: {
      email: 'fajar@email.com',
      passwordHash: userPassword,
      fullName: 'Fajar Rahman',
      phone: '081234567896',
      city: 'Jakarta',
      role: 'user',
      status: 'active',
    },
  });

  console.log('✅ Regular users created');

  // ─── Venues ──────────────────────────────────────────────────────────────────
  const venuesData = [
    {
      name: 'Arena Pro Futsal',
      location: 'Jl. Sudirman No. 123, Jakarta Selatan',
      city: 'Jakarta Selatan',
      description: 'Lapangan futsal indoor premium dengan fasilitas lengkap. Lantai vinyl berkualitas internasional.',
      type: VenueType.Indoor,
      pricePerHour: 150000,
      rating: 4.9,
      reviewCount: 45,
      owner: 'PT Arena Pro Indonesia',
      facilities: ['parking', 'shower', 'locker', 'wifi', 'cafeteria'],
      gallery: [],
      imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbc676e93d?w=800&q=80',
    },
    {
      name: 'GreenField Futsal',
      location: 'Jl. Kebon Jeruk No. 56, Jakarta Barat',
      city: 'Jakarta Barat',
      description: 'Lapangan futsal outdoor dengan rumput sintetis berkualitas tinggi.',
      type: VenueType.Outdoor,
      pricePerHour: 120000,
      rating: 4.7,
      reviewCount: 32,
      owner: 'CV GreenField Sport',
      facilities: ['parking', 'shower', 'wifi'],
      gallery: [],
      imageUrl: 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=800&q=80',
    },
    {
      name: 'SportZone Premium',
      location: 'Jl. Asia Afrika No. 89, Bandung',
      city: 'Bandung',
      description: 'Kompleks olahraga premium dengan lapangan futsal indoor standar internasional.',
      type: VenueType.Indoor,
      pricePerHour: 180000,
      rating: 4.8,
      reviewCount: 28,
      owner: 'PT SportZone Indonesia',
      facilities: ['parking', 'shower', 'locker', 'wifi', 'cafeteria'],
      gallery: [],
      imageUrl: 'https://images.unsplash.com/photo-1524015368236-bbf6f72545b6?w=800&q=80',
    },
    {
      name: 'Kickoff Arena',
      location: 'Jl. Basuki Rahmat No. 45, Surabaya',
      city: 'Surabaya',
      description: 'Lapangan futsal indoor yang nyaman dengan harga terjangkau.',
      type: VenueType.Indoor,
      pricePerHour: 100000,
      rating: 4.6,
      reviewCount: 22,
      owner: 'Kickoff Sport Group',
      facilities: ['parking', 'locker', 'wifi'],
      gallery: [],
      imageUrl: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80',
    },
    {
      name: 'Victory Futsal Court',
      location: 'Jl. Malioboro No. 78, Yogyakarta',
      city: 'Yogyakarta',
      description: 'Lapangan futsal outdoor dengan suasana yang asri dan nyaman.',
      type: VenueType.Outdoor,
      pricePerHour: 80000,
      rating: 4.5,
      reviewCount: 18,
      owner: 'Victory Sport Yogya',
      facilities: ['parking', 'shower'],
      gallery: [],
      imageUrl: 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80',
    },
    {
      name: 'Champion Sports Hall',
      location: 'Jl. Ahmad Yani No. 200, Bekasi',
      city: 'Bekasi',
      description: 'Sports hall multi-fungsi dengan lapangan futsal indoor berkualitas.',
      type: VenueType.Indoor,
      pricePerHour: 160000,
      rating: 4.8,
      reviewCount: 35,
      owner: 'PT Champion Sports',
      facilities: ['parking', 'shower', 'locker', 'wifi', 'cafeteria'],
      gallery: [],
      imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbc676e93d?w=800&q=80',
    },
  ];

  const createdVenues = [];
  for (const v of venuesData) {
    const venue = await prisma.venue.create({ data: v });
    createdVenues.push(venue);
  }
  console.log('✅ Venues created');

  // ─── Promo Codes ─────────────────────────────────────────────────────────────
  await prisma.promoCode.upsert({
    where: { code: 'FUTSAL10' },
    update: {},
    create: {
      code: 'FUTSAL10',
      discountPct: 10,
      isActive: true,
      validFrom: new Date(),
      validUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      maxUses: 100,
      usedCount: 5,
    },
  });

  await prisma.promoCode.upsert({
    where: { code: 'NEWUSER20' },
    update: {},
    create: {
      code: 'NEWUSER20',
      discountPct: 20,
      isActive: true,
      validFrom: new Date(),
      validUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      maxUses: 50,
      usedCount: 0,
    },
  });

  await prisma.promoCode.upsert({
    where: { code: 'WEEKEND15' },
    update: {},
    create: {
      code: 'WEEKEND15',
      discountPct: 15,
      isActive: false,
      validFrom: new Date('2025-01-01'),
      validUntil: new Date('2025-06-30'),
      maxUses: 200,
      usedCount: 200,
    },
  });

  console.log('✅ Promo codes created');

  // ─── Settings ────────────────────────────────────────────────────────────────
  const settingsData: { key: string; value: string; category: SettingCategory; updatedById: string }[] = [
    { key: 'site_name', value: 'Lapang.in', category: 'general', updatedById: admin.id },
    { key: 'contact_email', value: 'hello@lapangin.com', category: 'general', updatedById: admin.id },
    { key: 'default_currency', value: 'IDR', category: 'general', updatedById: admin.id },
    { key: 'timezone', value: 'Asia/Jakarta', category: 'general', updatedById: admin.id },
    { key: 'max_booking_duration', value: '4', category: 'general', updatedById: admin.id },
    { key: 'maintenance_mode', value: 'false', category: 'general', updatedById: admin.id },
    { key: 'auto_approve_venues', value: 'true', category: 'general', updatedById: admin.id },
    { key: 'service_fee_pct', value: '2', category: 'payment', updatedById: admin.id },
    { key: 'cancellation_fee_pct', value: '10', category: 'payment', updatedById: admin.id },
    { key: 'min_booking_value', value: '50000', category: 'payment', updatedById: admin.id },
    { key: 'payment_gateway', value: 'midtrans', category: 'payment', updatedById: admin.id },
    { key: 'payment_methods', value: 'credit_card,bank_transfer,qris,gopay,ovo,dana,shopeepay,linkaja', category: 'payment', updatedById: admin.id },
    { key: 'email_enabled', value: 'true', category: 'notification', updatedById: admin.id },
    { key: 'booking_alerts', value: 'true', category: 'notification', updatedById: admin.id },
    { key: 'cancellation_alerts', value: 'true', category: 'notification', updatedById: admin.id },
    { key: 'daily_report_time', value: '23:00', category: 'notification', updatedById: admin.id },
    { key: 'low_availability_warning', value: 'true', category: 'notification', updatedById: admin.id },
    { key: 'two_factor_enabled', value: 'false', category: 'security', updatedById: admin.id },
    { key: 'session_timeout', value: '30', category: 'security', updatedById: admin.id },
    { key: 'max_login_attempts', value: '5', category: 'security', updatedById: admin.id },
    { key: 'ip_whitelist', value: '', category: 'security', updatedById: admin.id },
    { key: 'api_rate_limit', value: '100', category: 'security', updatedById: admin.id },
  ];

  for (const setting of settingsData) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log('✅ Settings created');

  // ─── Sample Bookings ────────────────────────────────────────────────────────
  const users = [rizki, siti, budi, andi, maya];
  const bookingsData = [
    {
      bookingCode: 'BK-2026-001',
      userId: rizki.id,
      venueId: createdVenues[0].id,
      date: new Date('2026-07-25T00:00:00.000Z'),
      startTime: '18:00',
      durationHours: 2,
      subtotal: 300000,
      discount: 0,
      serviceFee: 5000,
      total: 305000,
      status: 'upcoming' as const,
      paymentMethod: 'bank_transfer',
      paymentDetail: 'BCA VA',
      paidAt: new Date(),
    },
    {
      bookingCode: 'BK-2026-002',
      userId: siti.id,
      venueId: createdVenues[1].id,
      date: new Date('2026-07-20T00:00:00.000Z'),
      startTime: '10:00',
      durationHours: 1,
      subtotal: 120000,
      discount: 12000,
      serviceFee: 5000,
      total: 113000,
      promoCode: 'FUTSAL10',
      status: 'completed' as const,
      paymentMethod: 'ewallet',
      paymentDetail: 'GoPay',
      paidAt: new Date('2026-07-20T09:30:00.000Z'),
    },
    {
      bookingCode: 'BK-2026-003',
      userId: budi.id,
      venueId: createdVenues[2].id,
      date: new Date('2026-07-18T00:00:00.000Z'),
      startTime: '14:00',
      durationHours: 2,
      subtotal: 360000,
      discount: 0,
      serviceFee: 5000,
      total: 365000,
      status: 'completed' as const,
      paymentMethod: 'credit_card',
      paymentDetail: 'Visa ****1234',
      paidAt: new Date('2026-07-18T13:45:00.000Z'),
    },
    {
      bookingCode: 'BK-2026-004',
      userId: andi.id,
      venueId: createdVenues[3].id,
      date: new Date('2026-07-22T00:00:00.000Z'),
      startTime: '19:00',
      durationHours: 1,
      subtotal: 100000,
      discount: 0,
      serviceFee: 5000,
      total: 105000,
      status: 'cancelled' as const,
      paymentMethod: 'qris',
      paymentDetail: 'QRIS',
    },
    {
      bookingCode: 'BK-2026-005',
      userId: maya.id,
      venueId: createdVenues[4].id,
      date: new Date('2026-07-26T00:00:00.000Z'),
      startTime: '08:00',
      durationHours: 3,
      subtotal: 240000,
      discount: 0,
      serviceFee: 5000,
      total: 245000,
      status: 'upcoming' as const,
      paymentMethod: 'ewallet',
      paymentDetail: 'OVO',
      paidAt: new Date(),
    },
  ];

  for (const b of bookingsData) {
    await prisma.booking.upsert({
      where: { bookingCode: b.bookingCode },
      update: {},
      create: b,
    });
  }
  console.log('✅ Sample bookings created');

  // ─── Sample Reviews ──────────────────────────────────────────────────────────
  // Get completed bookings for reviews
  const completedBookings = await prisma.booking.findMany({
    where: { status: 'completed' },
  });

  for (const booking of completedBookings) {
    await prisma.review.upsert({
      where: { bookingId: booking.id },
      update: {},
      create: {
        userId: booking.userId,
        venueId: booking.venueId,
        bookingId: booking.id,
        rating: Math.floor(Math.random() * 2) + 4, // 4 or 5
        comment: ['Lapangan bagus, bersih dan terawat!', 'Fasilitas lengkap, recommended!', 'Tempatnya nyaman, pasti balik lagi.'][Math.floor(Math.random() * 3)],
      },
    });
  }
  console.log('✅ Sample reviews created');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
