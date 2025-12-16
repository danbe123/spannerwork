/**
 * Database Seed Script
 *
 * Generates realistic sample data for SpannerWork marketplace.
 * All data is UK-based with real postcodes and coordinates.
 *
 * Usage: npm run db:seed
 */

import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// UK Postcodes with approximate coordinates
const UK_LOCATIONS = [
  { postcode: 'SW1A 1AA', address: 'Westminster, London', lat: 51.5014, lng: -0.1419 },
  { postcode: 'M1 1AE', address: 'Manchester City Centre', lat: 53.4808, lng: -2.2426 },
  { postcode: 'B1 1AA', address: 'Birmingham City Centre', lat: 52.4862, lng: -1.8904 },
  { postcode: 'LS1 1UR', address: 'Leeds City Centre', lat: 53.7997, lng: -1.5492 },
  { postcode: 'G1 1AA', address: 'Glasgow City Centre', lat: 55.8609, lng: -4.2514 },
  { postcode: 'L1 1AA', address: 'Liverpool City Centre', lat: 53.4084, lng: -2.9916 },
  { postcode: 'BS1 1AA', address: 'Bristol City Centre', lat: 51.4545, lng: -2.5879 },
  { postcode: 'S1 1AA', address: 'Sheffield City Centre', lat: 53.3811, lng: -1.4701 },
  { postcode: 'NE1 1AA', address: 'Newcastle City Centre', lat: 54.9783, lng: -1.6178 },
  { postcode: 'NG1 1AA', address: 'Nottingham City Centre', lat: 52.9548, lng: -1.1581 },
  { postcode: 'E1 6AN', address: 'Whitechapel, London', lat: 51.5152, lng: -0.0721 },
  { postcode: 'N1 9GU', address: 'Islington, London', lat: 51.5362, lng: -0.1033 },
  { postcode: 'SE1 9SG', address: 'Southwark, London', lat: 51.5045, lng: -0.0865 },
  { postcode: 'W1D 3QF', address: 'Soho, London', lat: 51.5136, lng: -0.1319 },
  { postcode: 'EC1V 9NR', address: 'Clerkenwell, London', lat: 51.5246, lng: -0.0992 },
  { postcode: 'CF10 1AA', address: 'Cardiff City Centre', lat: 51.4816, lng: -3.1791 },
  { postcode: 'EH1 1AA', address: 'Edinburgh City Centre', lat: 55.9533, lng: -3.1883 },
  { postcode: 'BN1 1AA', address: 'Brighton City Centre', lat: 50.8225, lng: -0.1372 },
  { postcode: 'OX1 1AA', address: 'Oxford City Centre', lat: 51.7520, lng: -1.2577 },
  { postcode: 'CB2 1AA', address: 'Cambridge City Centre', lat: 52.2053, lng: 0.1218 },
];

// Tool categories and sample tools
const TOOLS = [
  { category: 'Diagnostics', items: ['OBD2 Diagnostic Scanner', 'Advanced Diagnostic Tablet', 'Battery Analyzer', 'Smoke Leak Tester', 'Oscilloscope Kit'] },
  { category: 'Lifting & Support', items: ['Trolley Jack', 'Axle Stand Set', 'Engine Support Beam', 'Transmission Jack', 'Wheel Dolly Set'] },
  { category: 'Tyres & Wheels', items: ['Tyre Inflator', 'Torque Wrench', 'Wheel Balancer', 'Tyre Bead Breaker', 'Valve Tool Kit'] },
  { category: 'Brakes', items: ['Brake Bleeding Kit', 'Caliper Wind-Back Tool Set', 'Brake Line Flaring Tool', 'Pressure Bleeder', 'Brake Piston Spreader'] },
  { category: 'Air Con', items: ['AC Manifold Gauge Set', 'Vacuum Pump', 'Refrigerant Leak Detector', 'UV Dye Kit'] },
  { category: 'Workshop Equipment', items: ['Compressor', 'Impact Wrench', 'Creeper', 'Work Light', 'Parts Washer'] },
];

// Space types
const SPACES = [
  { type: 'Service Bay', features: ['Vehicle lift', 'Compressed air', 'Power outlets', 'Good lighting', 'Oil disposal'] },
  { type: 'Workshop Ramp Bay', features: ['Drive-on ramp', 'Power outlets', 'Tool storage', 'Ventilation'] },
  { type: 'MOT Prep Bay', features: ['Inspection pit', 'Tyre tread gauge', 'Headlight aligner space', 'Good lighting'] },
  { type: 'Detailing Bay', features: ['Pressure washer access', 'Drainage', 'Indoor cover', 'Power outlets'] },
  { type: 'Secure Parts Storage', features: ['Secure access', 'CCTV', 'Racking', '24/7 availability'] },
];

// Service specialties
const SERVICES = [
  { name: 'Vehicle Diagnostics', specialties: ['Engine management lights', 'No-start diagnosis', 'Electrical fault finding', 'DPF diagnosis'] },
  { name: 'Servicing', specialties: ['Oil & filter change', 'Interim service', 'Full service', 'Spark plugs'] },
  { name: 'Brakes & Suspension', specialties: ['Pads & discs', 'Brake fluid', 'Suspension bushes', 'Shock absorbers'] },
  { name: 'Tyres', specialties: ['Tyre fitting', 'Puncture repair', 'Wheel balancing', 'Tracking/alignment'] },
  { name: 'MOT Prep', specialties: ['Pre-MOT inspection', 'Emissions diagnosis', 'Headlight alignment', 'Minor repairs'] },
  { name: 'Air Con', specialties: ['Re-gas', 'Leak detection', 'Compressor diagnosis', 'Cabin filter'] },
  { name: 'Mobile Mechanic', specialties: ['On-site repairs', 'Battery replacement', 'Brake pads', 'Basic diagnostics'] },
];

// First names and last names for generating users
const FIRST_NAMES = ['James', 'Emma', 'Oliver', 'Sophia', 'William', 'Ava', 'Benjamin', 'Isabella', 'Lucas', 'Mia', 'Henry', 'Charlotte', 'Alexander', 'Amelia', 'Daniel', 'Harper', 'Michael', 'Evelyn', 'Ethan', 'Abigail', 'David', 'Emily', 'Joseph', 'Elizabeth', 'Samuel', 'Sofia', 'Sebastian', 'Avery', 'Jack', 'Ella'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Robinson', 'Clark', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Scott', 'Green'];

// Helper functions
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateUsername(firstName: string, lastName: string): string {
  return `${firstName.toLowerCase()}${lastName.toLowerCase()}${randomInt(1, 999)}`;
}

function generateBio(): string {
  const bios = [
    'DIY enthusiast with 10+ years experience. Happy to share tools and knowledge!',
    'Professional tradesperson looking to help out the community.',
    'Hobbyist maker with a well-equipped workshop.',
    'Retired engineer with quality tools available for rent.',
    'Home improvement addict. If I have it, you can borrow it!',
    'Local business owner supporting the sharing economy.',
    'Passionate about sustainability and reducing waste through sharing.',
    'Jack of all trades, master of some. Tools and expertise available.',
  ];
  return randomElement(bios);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function weeklyRateFromDaily(dailyRate: number): number {
  const multiplier = randomElement([4, 5, 6]);
  return clampInt(dailyRate * multiplier, 0, 2_000_000);
}

function toolDailyRate(category: string, toolName: string): number {
  const name = toolName.toLowerCase();

  if (category === 'Diagnostics') {
    if (name.includes('tablet')) return randomInt(6000, 15000);
    if (name.includes('oscilloscope')) return randomInt(3500, 9000);
    if (name.includes('smoke')) return randomInt(3000, 8000);
    return randomInt(1500, 6000);
  }

  if (category === 'Lifting & Support') {
    if (name.includes('transmission') || name.includes('engine support')) return randomInt(2500, 7000);
    return randomInt(1200, 4500);
  }

  if (category === 'Tyres & Wheels') {
    if (name.includes('balancer') || name.includes('bead')) return randomInt(3000, 9000);
    return randomInt(800, 3500);
  }

  if (category === 'Brakes') {
    if (name.includes('flaring') || name.includes('pressure')) return randomInt(1800, 5500);
    return randomInt(900, 3500);
  }

  if (category === 'Air Con') {
    if (name.includes('vacuum')) return randomInt(2500, 7000);
    return randomInt(1200, 5500);
  }

  if (category === 'Workshop Equipment') {
    if (name.includes('compressor') || name.includes('parts washer')) return randomInt(2500, 9000);
    if (name.includes('impact')) return randomInt(1500, 6000);
    return randomInt(800, 3000);
  }

  return randomInt(1000, 5000);
}

function toolDeposit(dailyRate: number, category: string): number {
  const multiplier = category === 'Diagnostics' ? randomElement([2, 3, 4]) : randomElement([1, 2, 3]);
  return clampInt(dailyRate * multiplier, 2000, 150000);
}

function spaceHourlyRate(spaceType: string): number {
  if (spaceType === 'Service Bay') return randomInt(3000, 6500);
  if (spaceType === 'Workshop Ramp Bay') return randomInt(2500, 5500);
  if (spaceType === 'MOT Prep Bay') return randomInt(2200, 5000);
  if (spaceType === 'Detailing Bay') return randomInt(1800, 4200);
  if (spaceType === 'Secure Parts Storage') return randomInt(300, 900);
  return randomInt(1500, 4000);
}

function spaceSizeSqFt(spaceType: string): number {
  if (spaceType === 'Secure Parts Storage') return randomInt(50, 300);
  if (spaceType === 'Detailing Bay') return randomInt(150, 500);
  return randomInt(200, 800);
}

function servicePricing(serviceName: string): { hourlyRate: number; calloutFee: number | null } {
  if (serviceName === 'Vehicle Diagnostics') {
    return { hourlyRate: randomInt(6500, 13000), calloutFee: randomElement([null, randomInt(0, 2500)]) };
  }
  if (serviceName === 'Servicing') {
    return { hourlyRate: randomInt(5000, 9500), calloutFee: randomElement([null, randomInt(0, 2000)]) };
  }
  if (serviceName === 'Brakes & Suspension') {
    return { hourlyRate: randomInt(5500, 11000), calloutFee: randomElement([null, randomInt(0, 2000)]) };
  }
  if (serviceName === 'Tyres') {
    return { hourlyRate: randomInt(4500, 8500), calloutFee: randomElement([null, randomInt(0, 1500)]) };
  }
  if (serviceName === 'MOT Prep') {
    return { hourlyRate: randomInt(5000, 10000), calloutFee: randomElement([null, randomInt(0, 2000)]) };
  }
  if (serviceName === 'Air Con') {
    return { hourlyRate: randomInt(5500, 10500), calloutFee: randomElement([null, randomInt(0, 2500)]) };
  }
  if (serviceName === 'Mobile Mechanic') {
    return { hourlyRate: randomInt(5500, 11000), calloutFee: randomInt(1500, 5000) };
  }
  return { hourlyRate: randomInt(4500, 9000), calloutFee: randomElement([null, randomInt(0, 2000)]) };
}

function requestCategoryForTitle(title: string): 'TOOLS' | 'EXPERTISE' | 'SPACE' {
  const t = title.toLowerCase();
  if (t.includes('service bay') || t.includes('detailing bay') || t.includes('bay')) return 'SPACE';
  if (t.includes('scanner') || t.includes('bleeding kit') || t.includes('trolley jack') || t.includes('axle stands') || t.includes('compressor') || t.includes('torque wrench') || t.includes('inflator')) return 'TOOLS';
  return 'EXPERTISE';
}

function requestBudget(category: 'TOOLS' | 'EXPERTISE' | 'SPACE', rateType: 'FIXED' | 'HOURLY' | 'DAILY'): number {
  if (category === 'TOOLS') {
    if (rateType === 'HOURLY') return randomInt(400, 1200);
    if (rateType === 'DAILY') return randomInt(1200, 9000);
    return randomInt(1500, 12000);
  }

  if (category === 'SPACE') {
    if (rateType === 'HOURLY') return randomInt(2000, 6500);
    if (rateType === 'DAILY') return randomInt(12000, 50000);
    return randomInt(15000, 60000);
  }

  if (rateType === 'HOURLY') return randomInt(4500, 10000);
  if (rateType === 'DAILY') return randomInt(30000, 80000);
  return randomInt(6000, 45000);
}

function requestRateType(title: string, category: 'TOOLS' | 'EXPERTISE' | 'SPACE'): 'FIXED' | 'HOURLY' | 'DAILY' {
  const t = title.toLowerCase();

  if (category === 'TOOLS') {
    if (t.includes('scanner') || t.includes('kit') || t.includes('compressor')) {
      return Math.random() > 0.15 ? 'DAILY' : 'FIXED';
    }
    return Math.random() > 0.25 ? 'DAILY' : 'FIXED';
  }

  if (category === 'SPACE') {
    if (t.includes('for a day') || t.includes('day')) return 'DAILY';
    return Math.random() > 0.4 ? 'HOURLY' : 'DAILY';
  }

  if (t.includes('re-gas') || t.includes('balancing') || t.includes('pads') || t.includes('discs') || t.includes('alignment') || t.includes('tracking')) {
    return 'FIXED';
  }

  return Math.random() > 0.55 ? 'HOURLY' : 'FIXED';
}

async function main() {
  console.log('Starting database seed...\n');

  // Clear existing data (in reverse order of dependencies)
  console.log('Clearing existing data...');
  await prisma.insuranceDocument.deleteMany();
  await prisma.dailyMetrics.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.userStats.deleteMany();
  await prisma.quickRebook.deleteMany();
  await prisma.notificationPreferences.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.review.deleteMany();
  await prisma.message.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.savedSearch.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.request.deleteMany();
  await prisma.tool.deleteMany();
  await prisma.space.deleteMany();
  await prisma.service.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.passwordHistory.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creating users...');

  // Create password hash (all users have password: "Password123!")
  const passwordHash = await bcrypt.hash('Password123!', 12);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@spannerwork.com',
      passwordHash,
      name: 'Admin User',
      username: 'admin',
      role: 'ADMIN',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      postcode: 'SW1A 1AA',
      locationAddress: 'Westminster, London',
      locationLat: 51.5014,
      locationLng: -0.1419,
      bio: 'SpannerWork platform administrator.',
      rating: 5.0,
    },
  });
  console.log(`  Created admin: ${admin.email}`);

  // Create moderator user
  const moderator = await prisma.user.create({
    data: {
      email: 'moderator@spannerwork.com',
      passwordHash,
      name: 'Moderator User',
      username: 'moderator',
      role: 'MODERATOR',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      postcode: 'M1 1AE',
      locationAddress: 'Manchester City Centre',
      locationLat: 53.4808,
      locationLng: -2.2426,
      bio: 'SpannerWork community moderator.',
      rating: 4.9,
    },
  });
  console.log(`  Created moderator: ${moderator.email}`);

  // Create regular users
  const users: Array<{ id: string; email: string; name: string; postcode: string; locationLat: number; locationLng: number }> = [];

  for (let i = 0; i < 50; i++) {
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const location = randomElement(UK_LOCATIONS);
    const name = `${firstName} ${lastName}`;

    const user = await prisma.user.create({
      data: {
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
        passwordHash,
        name,
        username: generateUsername(firstName, lastName),
        phone: `07${randomInt(100000000, 999999999)}`,
        postcode: location.postcode,
        locationAddress: location.address,
        locationLat: location.lat + (Math.random() - 0.5) * 0.05,
        locationLng: location.lng + (Math.random() - 0.5) * 0.05,
        bio: generateBio(),
        emailVerified: Math.random() > 0.1, // 90% verified
        emailVerifiedAt: Math.random() > 0.1 ? randomDate(new Date('2024-01-01'), new Date()) : null,
        rating: Math.random() > 0.3 ? parseFloat((3.5 + Math.random() * 1.5).toFixed(1)) : null,
        totalTransactions: randomInt(0, 50),
        totalReviews: randomInt(0, 30),
      },
    });

    users.push({
      id: user.id,
      email: user.email,
      name: user.name!,
      postcode: user.postcode!,
      locationLat: user.locationLat!,
      locationLng: user.locationLng!,
    });
  }
  console.log(`  Created ${users.length} regular users`);

  // Create tools
  console.log('Creating tools...');
  const tools: Array<{ id: string; name: string; ownerId: string; dailyRate: number }> = [];

  for (const category of TOOLS) {
    for (const toolName of category.items) {
      const owner = randomElement(users);
      const dailyRate = toolDailyRate(category.category, toolName);

      const tool = await prisma.tool.create({
        data: {
          name: toolName,
          description: `Quality ${toolName.toLowerCase()} available for rent. Well maintained and in excellent working condition. Perfect for DIY projects and professional use.`,
          category: category.category,
          dailyRate,
          weeklyRate: weeklyRateFromDaily(dailyRate),
          deposit: toolDeposit(dailyRate, category.category),
          photos: [],
          condition: randomElement(['Excellent', 'Good', 'Fair']),
          available: Math.random() > 0.1,
          postcode: owner.postcode,
          locationLat: owner.locationLat,
          locationLng: owner.locationLng,
          ownerId: owner.id,
        },
      });

      tools.push({ id: tool.id, name: tool.name, ownerId: owner.id, dailyRate });
    }
  }
  console.log(`  Created ${tools.length} tools`);

  // Create spaces
  console.log('Creating spaces...');
  const spaces: Array<{ id: string; name: string; ownerId: string; dailyRate: number }> = [];

  for (let i = 0; i < 30; i++) {
    const spaceType = randomElement(SPACES);
    const owner = randomElement(users);
    const hourlyRate = spaceHourlyRate(spaceType.type);
    const dailyRate = spaceType.type === 'Secure Parts Storage'
      ? randomInt(1500, 6000)
      : hourlyRate * 8;
    const weeklyRate = spaceType.type === 'Secure Parts Storage'
      ? Math.round(dailyRate * 7 * 0.65)
      : Math.round(dailyRate * 5 * 0.8);

    const space = await prisma.space.create({
      data: {
        name: `${owner.name.split(' ')[0]}'s ${spaceType.type}`,
        description: `${spaceType.type} available for rent. Ideal for projects, storage, or workspace needs. Clean, secure, and well-maintained.`,
        hourlyRate,
        dailyRate,
        weeklyRate,
        size: spaceSizeSqFt(spaceType.type),
        features: spaceType.features,
        photos: [],
        available: Math.random() > 0.15,
        postcode: owner.postcode,
        locationAddress: owner.postcode,
        locationLat: owner.locationLat,
        locationLng: owner.locationLng,
        ownerId: owner.id,
      },
    });

    spaces.push({ id: space.id, name: space.name, ownerId: owner.id, dailyRate });
  }
  console.log(`  Created ${spaces.length} spaces`);

  // Create services
  console.log('Creating services...');
  const services: Array<{ id: string; name: string; providerId: string; hourlyRate: number }> = [];

  for (let i = 0; i < 40; i++) {
    const serviceType = randomElement(SERVICES);
    const provider = randomElement(users);
    const { hourlyRate, calloutFee } = servicePricing(serviceType.name);

    const service = await prisma.service.create({
      data: {
        name: `${serviceType.name} Services`,
        description: `Professional ${serviceType.name.toLowerCase()} services. Fully insured and highly experienced. Free quotes available. Customer satisfaction guaranteed.`,
        specialties: serviceType.specialties.slice(0, randomInt(2, serviceType.specialties.length)),
        hourlyRate,
        calloutFee,
        radius: randomInt(5, 35),
        photos: [],
        available: Math.random() > 0.1,
        postcode: provider.postcode,
        locationLat: provider.locationLat,
        locationLng: provider.locationLng,
        providerId: provider.id,
      },
    });

    services.push({ id: service.id, name: service.name, providerId: provider.id, hourlyRate });
  }
  console.log(`  Created ${services.length} services`);

  // Create requests
  console.log('Creating requests...');
  const requests: Array<{ id: string; title: string; seekerId: string; budget: number; category: 'TOOLS' | 'EXPERTISE' | 'SPACE' }> = [];
  const requestTitles = [
    'Need an OBD2 scanner to diagnose engine light',
    'Looking for a service bay for a day (lift preferred)',
    'Brake bleeding kit needed this weekend',
    'Help diagnosing a no-start issue',
    'Tyre inflator and torque wrench for wheel swap',
    'Need a trolley jack and axle stands for DIY service',
    'MOT prep help for emissions and warning lights',
    'Battery test and replacement service',
    'Air con re-gas needed',
    'Wheel balancing needed after new tyres',
    'Leak test (smoke test) for vacuum/boost leak',
    'Looking for a detailing bay with drainage',
    'Need a compressor for impact tools',
    'Brake pads & discs fitting',
    'Tracking/alignment needed',
  ];

  for (let i = 0; i < 100; i++) {
    const seeker = randomElement(users);
    const title = randomElement(requestTitles);
    const category = requestCategoryForTitle(title);
    const urgency = randomElement(['ASAP', 'TODAY', 'THIS_WEEKEND', 'FLEXIBLE']) as 'ASAP' | 'TODAY' | 'THIS_WEEKEND' | 'FLEXIBLE';
    const status = randomElement(['ACTIVE', 'ACTIVE', 'ACTIVE', 'FULFILLED', 'EXPIRED']) as 'ACTIVE' | 'FULFILLED' | 'EXPIRED';
    const rateType = requestRateType(title, category);
    const budget = requestBudget(category, rateType);

    const request = await prisma.request.create({
      data: {
        title,
        description: `${title}. Please contact me if you can help. Located in ${seeker.postcode} area. Happy to discuss requirements and negotiate on price.`,
        category,
        urgency,
        budget,
        rateType,
        broadcastRadius: randomInt(5, 20),
        postcode: seeker.postcode,
        locationAddress: seeker.postcode,
        locationLat: seeker.locationLat,
        locationLng: seeker.locationLng,
        photos: [],
        status,
        responseCount: randomInt(0, 10),
        seekerId: seeker.id,
        expiresAt: new Date(Date.now() + randomInt(1, 14) * 24 * 60 * 60 * 1000),
      },
    });

    requests.push({ id: request.id, title: request.title, seekerId: seeker.id, budget, category });
  }
  console.log(`  Created ${requests.length} requests`);

  // Create transactions
  console.log('Creating transactions...');
  const transactions: Array<{ id: string; userId: string; providerId: string; status: string }> = [];

  const nextBookingStartByListing = new Map<string, Date>();

  for (let i = 0; i < 200; i++) {
    const user = randomElement(users);
    let provider = randomElement(users);
    while (provider.id === user.id) {
      provider = randomElement(users);
    }

    const durationDays = randomInt(1, 7);
    const status = randomElement(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED']) as 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

    // Randomly assign to a tool, space, or service
    const listingType = randomInt(1, 3);
    let toolId: string | null = null;
    let spaceId: string | null = null;
    let serviceId: string | null = null;

    if (listingType === 1 && tools.length > 0) {
      const tool = randomElement(tools);
      toolId = tool.id;
    } else if (listingType === 2 && spaces.length > 0) {
      const space = randomElement(spaces);
      spaceId = space.id;
    } else if (services.length > 0) {
      const service = randomElement(services);
      serviceId = service.id;
    }

    let rentalFee = 0;
    if (toolId) {
      const tool = tools.find(t => t.id === toolId);
      const daily = tool?.dailyRate ?? randomInt(1500, 7000);
      const discountFactor = durationDays >= 5 ? 0.8 : 1;
      rentalFee = Math.round(daily * durationDays * discountFactor);
    } else if (spaceId) {
      const space = spaces.find(s => s.id === spaceId);
      const daily = space?.dailyRate ?? randomInt(15000, 45000);
      const discountFactor = durationDays >= 5 ? 0.8 : 1;
      rentalFee = Math.round(daily * durationDays * discountFactor);
    } else if (serviceId) {
      const service = services.find(s => s.id === serviceId);
      const hourly = service?.hourlyRate ?? randomInt(5000, 10000);
      const hours = randomInt(1, 4);
      rentalFee = hourly * hours;
    } else {
      rentalFee = randomInt(5000, 40000);
    }

    rentalFee = clampInt(rentalFee, 500, 3_000_000);
    const platformFee = Math.round(rentalFee * 0.1);

    const listingKey = toolId
      ? `tool:${toolId}`
      : spaceId
        ? `space:${spaceId}`
        : serviceId
          ? `service:${serviceId}`
          : `none:${i}`;

    const fallbackStart = randomDate(new Date('2024-01-01'), new Date());
    const startDate = nextBookingStartByListing.get(listingKey) ?? fallbackStart;
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    nextBookingStartByListing.set(listingKey, new Date(endDate.getTime() + randomInt(1, 3) * 24 * 60 * 60 * 1000));

    const transaction = await prisma.transaction.create({
      data: {
        toolId,
        spaceId,
        serviceId,
        userId: user.id,
        providerId: provider.id,
        startDate,
        endDate,
        rentalFee,
        platformFee,
        totalAmount: rentalFee + platformFee,
        status,
        paymentStatus: status === 'COMPLETED' ? 'PAID' : status === 'CANCELLED' ? 'REFUNDED' : 'PENDING',
        notes: Math.random() > 0.7 ? 'Great experience!' : null,
        completedDate: status === 'COMPLETED' ? endDate : null,
      },
    });

    transactions.push({ id: transaction.id, userId: user.id, providerId: provider.id, status });
  }
  console.log(`  Created ${transactions.length} transactions`);

  // Create reviews for completed transactions
  console.log('Creating reviews...');
  let reviewCount = 0;

  for (const txn of transactions) {
    if (txn.status === 'COMPLETED' && Math.random() > 0.3) {
      const rating = randomInt(3, 5);
      const comments = [
        'Excellent experience! Highly recommended.',
        'Great communication and easy to deal with.',
        'Tool was in perfect condition. Would rent again.',
        'Very professional service. Thank you!',
        'Smooth transaction from start to finish.',
        'Good value for money.',
        'Quick response and flexible with timing.',
        'Everything as described. Very happy!',
      ];

      await prisma.review.create({
        data: {
          transactionId: txn.id,
          reviewerId: txn.userId,
          reviewedUserId: txn.providerId,
          rating,
          comment: randomElement(comments),
        },
      });
      reviewCount++;

      // Provider reviews renter back ~60% of the time
      if (Math.random() > 0.4) {
        await prisma.review.create({
          data: {
            transactionId: txn.id,
            reviewerId: txn.providerId,
            reviewedUserId: txn.userId,
            rating: randomInt(3, 5),
            comment: randomElement(['Great renter!', 'Returned in good condition.', 'Friendly and reliable.', 'Would rent to again.']),
          },
        });
        reviewCount++;
      }
    }
  }
  console.log(`  Created ${reviewCount} reviews`);

  // Create messages
  console.log('Creating messages...');
  let messageCount = 0;

  for (let i = 0; i < 300; i++) {
    const sender = randomElement(users);
    let recipient = randomElement(users);
    while (recipient.id === sender.id) {
      recipient = randomElement(users);
    }

    const messages = [
      'Hi, is this still available?',
      'What condition is it in?',
      'Can I pick up this weekend?',
      'How flexible are you on price?',
      'Thanks for the quick response!',
      'Yes, that works for me.',
      'I can come tomorrow if that suits?',
      'Perfect, see you then!',
      'Is there parking available?',
      'Do you have any availability next week?',
    ];

    await prisma.message.create({
      data: {
        senderId: sender.id,
        recipientId: recipient.id,
        content: randomElement(messages),
        read: Math.random() > 0.3,
        createdDate: randomDate(new Date('2024-06-01'), new Date()),
      },
    });
    messageCount++;
  }
  console.log(`  Created ${messageCount} messages`);

  // Create activity events
  console.log('Creating activity events...');
  const activityTypes = ['LISTING_CREATED', 'LISTING_BOOKED', 'REQUEST_POSTED', 'REQUEST_FULFILLED', 'TRANSACTION_COMPLETED', 'REVIEW_POSTED', 'USER_JOINED', 'BADGE_EARNED'] as const;

  for (let i = 0; i < 100; i++) {
    const actor = randomElement(users);
    const type = randomElement([...activityTypes]);

    const listingKind = randomElement(['tool', 'space', 'service'] as const);
    const listingTarget = listingKind === 'tool'
      ? randomElement(tools)
      : listingKind === 'space'
        ? randomElement(spaces)
        : randomElement(services);

    const requestTarget = requests.length > 0 ? randomElement(requests) : null;
    const transactionTarget = transactions.length > 0 ? randomElement(transactions) : null;

    const seededTargetType =
      type === 'REQUEST_POSTED' || type === 'REQUEST_FULFILLED'
        ? 'request'
        : type === 'TRANSACTION_COMPLETED'
          ? 'transaction'
          : type === 'LISTING_CREATED' || type === 'LISTING_BOOKED'
            ? listingKind
            : type === 'USER_JOINED' || type === 'BADGE_EARNED'
              ? 'user'
              : 'review';

    const seededTargetId =
      seededTargetType === 'request'
        ? requestTarget?.id
        : seededTargetType === 'transaction'
          ? transactionTarget?.id
          : seededTargetType === 'tool' || seededTargetType === 'space' || seededTargetType === 'service'
            ? listingTarget?.id
            : actor.id;

    const seededMetadata: Record<string, unknown> =
      seededTargetType === 'request'
        ? { category: requestTarget?.category ?? 'help' }
        : seededTargetType === 'transaction'
          ? { type: listingKind }
          : seededTargetType === 'tool' || seededTargetType === 'space' || seededTargetType === 'service'
            ? { itemType: seededTargetType, itemName: listingTarget?.name ?? 'listing' }
            : { itemType: 'tool', itemName: 'OBD2 Diagnostic Scanner' };

    await prisma.activityEvent.create({
      data: {
        type,
        actorId: actor.id,
        targetType: seededTargetType,
        targetId: seededTargetId,
        metadata: seededMetadata as Prisma.InputJsonValue,
        isPublic: true,
        postcode: actor.postcode,
        createdAt: randomDate(new Date('2024-06-01'), new Date()),
      },
    });
  }
  console.log('  Created 100 activity events');

  // Create user badges
  console.log('Creating user badges...');
  const badgeTypes = ['EARLY_ADOPTER', 'PROFILE_COMPLETE', 'FIRST_LISTING', 'FIRST_REQUEST', 'FIRST_RENTAL', 'FIVE_STAR_RATING'] as const;
  let badgeCount = 0;

  for (const user of users.slice(0, 30)) {
    const numBadges = randomInt(1, 4);
    const userBadges = [...badgeTypes].sort(() => Math.random() - 0.5).slice(0, numBadges);

    for (const badge of userBadges) {
      await prisma.userBadge.create({
        data: {
          userId: user.id,
          badge,
          earnedAt: randomDate(new Date('2024-01-01'), new Date()),
        },
      });
      badgeCount++;
    }
  }
  console.log(`  Created ${badgeCount} user badges`);

  // Create user stats
  console.log('Creating user stats...');
  for (const user of users) {
    await prisma.userStats.create({
      data: {
        userId: user.id,
        totalListings: randomInt(0, 10),
        totalRequests: randomInt(0, 20),
        totalRentalsAsRenter: randomInt(0, 30),
        totalRentalsAsProvider: randomInt(0, 25),
        averageResponseMinutes: randomInt(5, 120),
        cancellationRate: Math.random() * 0.1,
        completionRate: 90 + Math.random() * 10,
        totalEarned: randomInt(0, 500000),
        totalSpent: randomInt(0, 100000),
        currentStreak: randomInt(0, 30),
        longestStreak: randomInt(0, 60),
        successfulReferrals: randomInt(0, 5),
      },
    });
  }
  console.log(`  Created ${users.length} user stats records`);

  // Create notification preferences
  console.log('Creating notification preferences...');
  for (const user of users) {
    await prisma.notificationPreferences.create({
      data: {
        userId: user.id,
        emailEnabled: Math.random() > 0.1,
        pushEnabled: Math.random() > 0.3,
        smsEnabled: Math.random() > 0.7,
      },
    });
  }
  console.log(`  Created ${users.length} notification preference records`);

  // Create referrals
  console.log('Creating referrals...');
  for (let i = 0; i < 20; i++) {
    const referrer = randomElement(users);
    const referred = Math.random() > 0.3 ? randomElement(users.filter(u => u.id !== referrer.id)) : null;

    await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: referred?.id,
        code: `REF${randomInt(100000, 999999)}`,
        status: referred ? 'COMPLETED' : 'PENDING',
        reward: referred ? 1000 : null,
        completedDate: referred ? randomDate(new Date('2024-01-01'), new Date()) : null,
      },
    });
  }
  console.log('  Created 20 referrals');

  // Create daily metrics
  console.log('Creating daily metrics...');
  const startMetricsDate = new Date('2024-01-01');
  const endMetricsDate = new Date();
  let currentDate = new Date(startMetricsDate);
  let metricsCount = 0;

  while (currentDate <= endMetricsDate) {
    await prisma.dailyMetrics.create({
      data: {
        date: new Date(currentDate),
        totalUsers: 50 + metricsCount * 2,
        newUsers: randomInt(1, 10),
        activeUsers: randomInt(20, 100),
        totalListings: tools.length + spaces.length + services.length,
        totalBookings: randomInt(5, 30),
        gmv: randomInt(100000, 500000),
        platformRevenue: randomInt(10000, 50000),
      },
    });
    currentDate.setDate(currentDate.getDate() + 1);
    metricsCount++;
  }
  console.log(`  Created ${metricsCount} daily metrics records`);

  console.log('\n========================================');
  console.log('Seed completed successfully!');
  console.log('========================================');
  console.log('\nSummary:');
  console.log(`  - Users: ${users.length + 2} (including admin & moderator)`);
  console.log(`  - Tools: ${tools.length}`);
  console.log(`  - Spaces: ${spaces.length}`);
  console.log(`  - Services: ${services.length}`);
  console.log(`  - Requests: ${requests.length}`);
  console.log(`  - Transactions: ${transactions.length}`);
  console.log(`  - Reviews: ${reviewCount}`);
  console.log(`  - Messages: ${messageCount}`);
  console.log(`  - Daily Metrics: ${metricsCount}`);
  console.log('\nTest Accounts:');
  console.log('  Admin: admin@spannerwork.com / Password123!');
  console.log('  Moderator: moderator@spannerwork.com / Password123!');
  console.log('  Users: [firstname].[lastname][n]@example.com / Password123!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
