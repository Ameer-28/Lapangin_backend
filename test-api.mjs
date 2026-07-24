// API Test Script for Lapang.in Backend
const BASE = 'http://localhost:3000/api';

async function request(method, path, body = null, token = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json().catch(() => res.text());
    return { status: res.status, data };
  } catch (e) {
    return { status: 'ERROR', data: e.message };
  }
}

function log(label, result) {
  const icon = result.status >= 200 && result.status < 300 ? '✅' : '❌';
  console.log(`${icon} [${result.status}] ${label}`);
  if (result.status >= 400) console.log('   ', JSON.stringify(result.data));
}

async function main() {
  console.log('=== 1. AUTH MODULE ===');

  // Register
  const reg = await request('POST', '/auth/register', {
    fullName: 'Test User',
    email: `testuser${Date.now()}@email.com`,
    password: 'password123',
  });
  log('POST /auth/register', reg);

  // Login user
  const login = await request('POST', '/auth/login', {
    email: 'rizki@email.com',
    password: 'password123',
  });
  log('POST /auth/login', login);
  const userToken = login.data?.access_token;

  // Admin login
  const adminLogin = await request('POST', '/auth/admin/login', {
    email: 'admin@lapangin.com',
    password: 'admin123',
  });
  log('POST /auth/admin/login', adminLogin);
  const adminToken = adminLogin.data?.access_token;

  if (!userToken || !adminToken) {
    console.log('❌ Cannot proceed without tokens. Check seed data.');
    return;
  }

  // Get profile
  const profile = await request('GET', '/auth/profile', null, userToken);
  log('GET /auth/profile', profile);

  console.log('\n=== 2. USERS MODULE ===');
  const me = await request('GET', '/users/me', null, userToken);
  log('GET /users/me', me);

  const stats = await request('GET', '/users/me/stats', null, userToken);
  log('GET /users/me/stats', stats);

  const updateProfile = await request('PATCH', '/users/me', { phone: '08123456789' }, userToken);
  log('PATCH /users/me', updateProfile);

  const updateNotif = await request('PATCH', '/users/me/notifications', { emailNotifications: false }, userToken);
  log('PATCH /users/me/notifications', updateNotif);

  console.log('\n=== 3. ADMIN USERS ===');
  const adminUsers = await request('GET', '/admin/users?page=1&limit=5', null, adminToken);
  log('GET /admin/users', adminUsers);

  const adminUserStats = await request('GET', '/admin/users/stats', null, adminToken);
  log('GET /admin/users/stats', adminUserStats);

  console.log('\n=== 4. VENUES MODULE ===');
  const venues = await request('GET', '/venues?page=1&limit=10', null);
  log('GET /venues', venues);

  const featured = await request('GET', '/venues/featured', null);
  log('GET /venues/featured', featured);

  // Get first venue ID for detail tests
  let venueId = null;
  if (venues.data?.data?.length > 0) {
    venueId = venues.data.data[0].id;
    const venueDetail = await request('GET', `/venues/${venueId}`, null);
    log(`GET /venues/${venueId}`, venueDetail);

    const today = new Date().toISOString().split('T')[0];
    const timeSlots = await request('GET', `/venues/${venueId}/time-slots?date=${today}`, null);
    log(`GET /venues/${venueId}/time-slots`, timeSlots);

    const reviews = await request('GET', `/venues/${venueId}/reviews?page=1&limit=5`, null);
    log(`GET /venues/${venueId}/reviews`, reviews);
  }

  console.log('\n=== 5. ADMIN VENUES ===');
  const adminVenues = await request('GET', '/admin/venues?page=1&limit=5', null, adminToken);
  log('GET /admin/venues', adminVenues);

  const newVenue = await request('POST', '/admin/venues', {
    name: 'Test Venue',
    location: 'Jl. Test No. 1',
    city: 'Jakarta',
    type: 'Indoor',
    pricePerHour: 100000,
    facilities: ['parking', 'wifi'],
  }, adminToken);
  log('POST /admin/venues', newVenue);

  if (newVenue.data?.id) {
    const toggleVenue = await request('PATCH', `/admin/venues/${newVenue.data.id}/status`, null, adminToken);
    log('PATCH /admin/venues/:id/status', toggleVenue);

    const delVenue = await request('DELETE', `/admin/venues/${newVenue.data.id}`, null, adminToken);
    log('DELETE /admin/venues/:id', delVenue);
  }

  console.log('\n=== 6. BOOKINGS MODULE ===');
  // Create a booking
  if (venueId) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const booking = await request('POST', '/bookings', {
      venueId,
      date: dateStr,
      startTime: '10:00',
      durationHours: 2,
      paymentMethod: 'bank_transfer',
      paymentDetail: 'BCA VA',
    }, userToken);
    log('POST /bookings', booking);

    if (booking.data?.id) {
      const bookingDetail = await request('GET', `/bookings/${booking.data.id}`, null, userToken);
      log(`GET /bookings/${booking.data.id}`, bookingDetail);

      // Cancel booking
      const cancel = await request('PATCH', `/bookings/${booking.data.id}/cancel`, null, userToken);
      log(`PATCH /bookings/${booking.data.id}/cancel`, cancel);
    }
  }

  const myBookings = await request('GET', '/bookings?page=1&limit=10', null, userToken);
  log('GET /bookings (user)', myBookings);

  console.log('\n=== 7. ADMIN BOOKINGS ===');
  const adminBookings = await request('GET', '/admin/bookings?page=1&limit=5', null, adminToken);
  log('GET /admin/bookings', adminBookings);

  const bookingStats = await request('GET', '/admin/bookings/stats', null, adminToken);
  log('GET /admin/bookings/stats', bookingStats);

  console.log('\n=== 8. PAYMENTS MODULE ===');
  // Get a booking to test payment
  if (myBookings.data?.items?.length > 0) {
    const bId = myBookings.data.items[0].id;
    const payStatus = await request('GET', `/payments/${bId}`, null, userToken);
    log(`GET /payments/${bId}`, payStatus);
  }

  console.log('\n=== 9. FAVORITES MODULE ===');
  if (venueId) {
    const addFav = await request('POST', `/favorites/${venueId}`, null, userToken);
    log(`POST /favorites/${venueId}`, addFav);

    const checkFav = await request('GET', `/favorites/${venueId}/check`, null, userToken);
    log(`GET /favorites/${venueId}/check`, checkFav);

    const listFav = await request('GET', '/favorites', null, userToken);
    log('GET /favorites', listFav);

    const removeFav = await request('DELETE', `/favorites/${venueId}`, null, userToken);
    log(`DELETE /favorites/${venueId}`, removeFav);
  }

  console.log('\n=== 10. PROMO CODES MODULE ===');
  const validatePromo = await request('POST', '/promo-codes/validate', { code: 'FUTSAL10' }, userToken);
  log('POST /promo-codes/validate (FUTSAL10)', validatePromo);

  const validateBad = await request('POST', '/promo-codes/validate', { code: 'INVALID' }, userToken);
  log('POST /promo-codes/validate (INVALID)', validateBad);

  console.log('\n=== 11. ADMIN PROMO CODES ===');
  const listPromos = await request('GET', '/admin/promo-codes', null, adminToken);
  log('GET /admin/promo-codes', listPromos);

  const newPromo = await request('POST', '/admin/promo-codes', {
    code: 'TESTPROMO',
    discountPct: 25,
    validFrom: '2026-01-01',
    validUntil: '2027-12-31',
    maxUses: 10,
  }, adminToken);
  log('POST /admin/promo-codes', newPromo);

  if (newPromo.data?.id) {
    const delPromo = await request('DELETE', `/admin/promo-codes/${newPromo.data.id}`, null, adminToken);
    log('DELETE /admin/promo-codes/:id', delPromo);
  }

  console.log('\n=== 12. ADMIN REPORTS ===');
  const overview = await request('GET', '/admin/reports/overview', null, adminToken);
  log('GET /admin/reports/overview', overview);

  const revenue = await request('GET', '/admin/reports/revenue?months=6', null, adminToken);
  log('GET /admin/reports/revenue', revenue);

  const byStatus = await request('GET', '/admin/reports/bookings-by-status', null, adminToken);
  log('GET /admin/reports/bookings-by-status', byStatus);

  const monthly = await request('GET', '/admin/reports/monthly-bookings?months=6', null, adminToken);
  log('GET /admin/reports/monthly-bookings', monthly);

  const typeSplit = await request('GET', '/admin/reports/venue-type-split', null, adminToken);
  log('GET /admin/reports/venue-type-split', typeSplit);

  const topVenues = await request('GET', '/admin/reports/top-venues?limit=3', null, adminToken);
  log('GET /admin/reports/top-venues', topVenues);

  const financial = await request('GET', '/admin/reports/financial?period=6months', null, adminToken);
  log('GET /admin/reports/financial', financial);

  console.log('\n=== 13. ADMIN SETTINGS ===');
  const allSettings = await request('GET', '/admin/settings', null, adminToken);
  log('GET /admin/settings', allSettings);

  const generalSettings = await request('GET', '/admin/settings/general', null, adminToken);
  log('GET /admin/settings/general', generalSettings);

  const updateSettings = await request('PATCH', '/admin/settings', {
    settings: [{ key: 'site_name', value: 'Lapang.in Updated' }],
  }, adminToken);
  log('PATCH /admin/settings', updateSettings);

  console.log('\n=== 14. SECURITY TESTS ===');
  // Unauthorized access
  const noAuth = await request('GET', '/users/me');
  log('GET /users/me (no token)', noAuth);

  // User accessing admin routes
  const userAdmin = await request('GET', '/admin/users', null, userToken);
  log('GET /admin/users (user token)', userAdmin);

  console.log('\n=== TESTS COMPLETE ===');
}

main().catch(console.error);
