/**
 * Demo Users Seed Script
 *
 * Creates 5 fully verified demo users with profile pictures and sample jobs.
 * These users work throughout the entire site.
 *
 * Usage: npx tsx prisma/seed-demo-users.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Demo users with realistic UK details
const DEMO_USERS = [
  {
    email: 'mike.harrison@spannerwork.demo',
    name: 'Mike Harrison',
    username: 'mikeharrison',
    phone: '07712345678',
    bio: 'Classic car enthusiast and weekend mechanic. 15 years experience working on British classics. Happy to help with restoration projects and general maintenance.',
    postcode: 'HR1 2LR',
    locationAddress: 'Hereford, Herefordshire',
    locationLat: 52.0565,
    locationLng: -2.7160,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
  },
  {
    email: 'sarah.jenkins@spannerwork.demo',
    name: 'Sarah Jenkins',
    username: 'sarahjenkins',
    phone: '07723456789',
    bio: 'Professional mechanic with a fully equipped home workshop. Specialising in German vehicles - VW, Audi, BMW, and Mercedes. MOT prep and diagnostics available.',
    postcode: 'WR1 2NJ',
    locationAddress: 'Worcester, Worcestershire',
    locationLat: 52.1936,
    locationLng: -2.2216,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
  },
  {
    email: 'dave.thompson@spannerwork.demo',
    name: 'Dave Thompson',
    username: 'davethompson',
    phone: '07734567890',
    bio: 'Retired garage owner with 30+ years in the trade. Got all the tools and knowledge - just looking to help out the local community and keep my hand in.',
    postcode: 'GL1 1SS',
    locationAddress: 'Gloucester, Gloucestershire',
    locationLat: 51.8642,
    locationLng: -2.2382,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
  },
  {
    email: 'emma.williams@spannerwork.demo',
    name: 'Emma Williams',
    username: 'emmawilliams',
    phone: '07745678901',
    bio: 'DIY enthusiast with a double garage workshop. Love working on project cars at weekends. Tools available and happy to lend a hand with your projects!',
    postcode: 'LD1 6AS',
    locationAddress: 'Llandrindod Wells, Powys',
    locationLat: 52.2417,
    locationLng: -3.3800,
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
  },
  {
    email: 'james.roberts@spannerwork.demo',
    name: 'James Roberts',
    username: 'jamesroberts',
    phone: '07756789012',
    bio: 'Mobile mechanic covering Shropshire and the Welsh borders. Equipped van with diagnostics, tools, and parts. No job too small - happy to help!',
    postcode: 'SY1 1DP',
    locationAddress: 'Shrewsbury, Shropshire',
    locationLat: 52.7080,
    locationLng: -2.7539,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
  },
];

// Sample job requests for the demo users with photos
// Using picsum.photos for reliable placeholder images
const SAMPLE_JOBS = [
  {
    title: 'Need OBD2 scanner for weekend diagnostics',
    description: 'My engine management light came on and I need to read the fault codes before deciding on next steps. Would like to borrow an OBD2 scanner this weekend. Happy to collect and return. Located in Hereford area.',
    category: 'TOOLS' as const,
    urgency: 'THIS_WEEKEND' as const,
    budget: 1500, // £15 in pence
    rateType: 'DAILY' as const,
    broadcastRadius: 15,
    photos: [
      'https://picsum.photos/seed/obd2scanner/800/600',
    ],
  },
  {
    title: 'Looking for a service bay with lift for day',
    description: 'Need to do a full service on my Land Rover Defender including oil change, filters, and check the suspension. Would be great to have access to a lift for the day. Will bring my own tools and supplies.',
    category: 'SPACE' as const,
    urgency: 'FLEXIBLE' as const,
    budget: 8000, // £80 in pence
    rateType: 'DAILY' as const,
    broadcastRadius: 25,
    photos: [
      'https://picsum.photos/seed/servicebay/800/600',
    ],
  },
  {
    title: 'Help with brake disc and pad replacement',
    description: 'Looking for someone to help me change the front brake discs and pads on my Ford Focus. I have the parts but could use some guidance and maybe borrow a caliper wind-back tool. Will pay for your time!',
    category: 'EXPERTISE' as const,
    urgency: 'THIS_WEEKEND' as const,
    budget: 5000, // £50 in pence
    rateType: 'FIXED' as const,
    broadcastRadius: 20,
    photos: [
      'https://picsum.photos/seed/brakerepair/800/600',
    ],
  },
  {
    title: 'Torque wrench needed for wheel change',
    description: 'Just got new alloys fitted and need to re-torque the wheel nuts after 50 miles. Looking to borrow a torque wrench briefly. Happy to collect from Gloucester or Worcester area.',
    category: 'TOOLS' as const,
    urgency: 'TODAY' as const,
    budget: 500, // £5 in pence
    rateType: 'DAILY' as const,
    broadcastRadius: 30,
    photos: [
      'https://picsum.photos/seed/torquewrench/800/600',
    ],
  },
  {
    title: 'Air con re-gas service needed',
    description: 'My car air conditioning is blowing warm. Need someone with the equipment to check for leaks and re-gas the system. BMW 3 Series 2019. Can come to you or you can come to me.',
    category: 'EXPERTISE' as const,
    urgency: 'FLEXIBLE' as const,
    budget: 6000, // £60 in pence
    rateType: 'FIXED' as const,
    broadcastRadius: 20,
    photos: [
      'https://picsum.photos/seed/airconregas/800/600',
    ],
  },
  {
    title: 'Workshop space for classic car restoration',
    description: 'Working on restoring a 1972 MGB GT. Looking for regular access to a dry, secure workshop space with power. Ideally would have access 2-3 days a week for the next few months.',
    category: 'SPACE' as const,
    urgency: 'FLEXIBLE' as const,
    budget: 15000, // £150 in pence (weekly)
    rateType: 'DAILY' as const,
    broadcastRadius: 25,
    photos: [
      'https://picsum.photos/seed/classiccar/800/600',
    ],
  },
  {
    title: 'Trolley jack and axle stands for service',
    description: 'Need to get under my car for an oil change and inspection. Looking to borrow a quality trolley jack and a set of axle stands for the weekend. Will collect and return promptly.',
    category: 'TOOLS' as const,
    urgency: 'THIS_WEEKEND' as const,
    budget: 2000, // £20 in pence
    rateType: 'DAILY' as const,
    broadcastRadius: 15,
    photos: [
      'https://picsum.photos/seed/trolleyjack/800/600',
    ],
  },
  {
    title: 'Diagnostic help - intermittent misfire',
    description: 'My Audi A4 has developed an intermittent misfire under load. Local garage wants £££ just to diagnose it. Looking for someone with VAG-COM/VCDS who can help me find the fault.',
    category: 'EXPERTISE' as const,
    urgency: 'ASAP' as const,
    budget: 4000, // £40 in pence
    rateType: 'FIXED' as const,
    broadcastRadius: 30,
    photos: [
      'https://picsum.photos/seed/diagnostic/800/600',
    ],
  },
  {
    title: 'Compressor for painting bumper',
    description: 'Need to respray a bumper and need access to a compressor and spray gun. Have my own primer and paint. Just need the equipment for a day. Experience welcome but not essential.',
    category: 'TOOLS' as const,
    urgency: 'FLEXIBLE' as const,
    budget: 3500, // £35 in pence
    rateType: 'DAILY' as const,
    broadcastRadius: 20,
    photos: [
      'https://picsum.photos/seed/compressor/800/600',
    ],
  },
  {
    title: 'Wheel alignment check after new suspension',
    description: 'Just fitted new coilovers on my Honda Civic and need the tracking checked and adjusted. Looking for someone with the equipment or access to a hunter machine. Shrewsbury/Telford area.',
    category: 'EXPERTISE' as const,
    urgency: 'THIS_WEEKEND' as const,
    budget: 3500, // £35 in pence
    rateType: 'FIXED' as const,
    broadcastRadius: 25,
    photos: [
      'https://picsum.photos/seed/wheelalignment/800/600',
    ],
  },
];

async function main() {
  console.log('Starting demo users seed...\n');

  // Create password hash (all demo users have password: "Demo123!")
  const passwordHash = await bcrypt.hash('Demo123!', 12);

  // Create the 5 demo users
  const createdUsers: Array<{ id: string; email: string; postcode: string; locationLat: number; locationLng: number }> = [];

  for (const userData of DEMO_USERS) {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: userData.email }
    });

    if (existing) {
      console.log(`  User ${userData.email} already exists, skipping...`);
      createdUsers.push({
        id: existing.id,
        email: existing.email,
        postcode: existing.postcode!,
        locationLat: existing.locationLat!,
        locationLng: existing.locationLng!,
      });
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash,
        name: userData.name,
        username: userData.username,
        phone: userData.phone,
        bio: userData.bio,
        avatar: userData.avatar,
        postcode: userData.postcode,
        locationAddress: userData.locationAddress,
        locationLat: userData.locationLat,
        locationLng: userData.locationLng,
        role: 'USER',
        accountStatus: 'ACTIVE',
        // Fully verified
        emailVerified: true,
        emailVerifiedAt: new Date(),
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        idVerified: true,
        insuranceVerified: false,
        // Good reputation
        rating: 4.5 + Math.random() * 0.5, // 4.5-5.0
        totalTransactions: Math.floor(Math.random() * 20) + 5,
        totalReviews: Math.floor(Math.random() * 15) + 3,
        // Terms accepted
        termsAcceptedAt: new Date(),
        termsVersion: '1.0',
        privacyPolicyAcceptedAt: new Date(),
        privacyPolicyVersion: '1.0',
      },
    });

    console.log(`  Created demo user: ${user.name} (${user.email})`);

    // Create user stats
    await prisma.userStats.create({
      data: {
        userId: user.id,
        totalListings: Math.floor(Math.random() * 5),
        totalRequests: Math.floor(Math.random() * 10) + 2,
        totalRentalsAsRenter: Math.floor(Math.random() * 15) + 3,
        totalRentalsAsProvider: Math.floor(Math.random() * 10),
        averageResponseMinutes: Math.floor(Math.random() * 30) + 10,
        cancellationRate: Math.random() * 0.05,
        completionRate: 95 + Math.random() * 5,
        totalEarned: Math.floor(Math.random() * 50000),
        totalSpent: Math.floor(Math.random() * 30000),
        currentStreak: Math.floor(Math.random() * 10),
        longestStreak: Math.floor(Math.random() * 30) + 5,
        successfulReferrals: Math.floor(Math.random() * 3),
      },
    });

    // Create notification preferences
    await prisma.notificationPreference.create({
      data: {
        userId: user.id,
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: false,
      },
    });

    // Give them some badges
    const badges = ['PROFILE_COMPLETE', 'FIRST_RENTAL', 'VERIFIED_PRO'] as const;
    for (const badge of badges) {
      await prisma.userBadge.create({
        data: {
          userId: user.id,
          badge,
          earnedAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Random date in last 90 days
        },
      });
    }

    createdUsers.push({
      id: user.id,
      email: user.email,
      postcode: user.postcode!,
      locationLat: user.locationLat!,
      locationLng: user.locationLng!,
    });
  }

  console.log(`\nCreated ${createdUsers.length} demo users`);

  // Create sample job requests distributed among users
  console.log('\nCreating sample job requests...');

  for (let i = 0; i < SAMPLE_JOBS.length; i++) {
    const job = SAMPLE_JOBS[i];
    const user = createdUsers[i % createdUsers.length]; // Distribute jobs among users

    // Check if similar request already exists for this user
    const existingRequest = await prisma.request.findFirst({
      where: {
        seekerId: user.id,
        title: job.title,
      }
    });

    if (existingRequest) {
      console.log(`  Request "${job.title.substring(0, 40)}..." already exists, skipping...`);
      continue;
    }

    await prisma.request.create({
      data: {
        title: job.title,
        description: job.description,
        category: job.category,
        urgency: job.urgency,
        budget: job.budget,
        rateType: job.rateType,
        broadcastRadius: job.broadcastRadius,
        postcode: user.postcode,
        locationAddress: user.postcode,
        locationLat: user.locationLat + (Math.random() - 0.5) * 0.02, // Slight variation
        locationLng: user.locationLng + (Math.random() - 0.5) * 0.02,
        photos: job.photos,
        status: 'ACTIVE',
        responseCount: Math.floor(Math.random() * 5),
        seekerId: user.id,
        expiresAt: new Date(Date.now() + (7 + Math.floor(Math.random() * 7)) * 24 * 60 * 60 * 1000), // 7-14 days
      },
    });

    console.log(`  Created job: "${job.title.substring(0, 50)}..." by ${createdUsers[i % createdUsers.length].email.split('@')[0]}`);
  }

  // Create activity events for the demo users
  console.log('\nCreating activity events...');

  for (const user of createdUsers) {
    // User joined event
    await prisma.activityEvent.create({
      data: {
        type: 'USER_JOINED',
        actorId: user.id,
        targetType: 'user',
        targetId: user.id,
        metadata: {},
        isPublic: true,
        postcode: user.postcode,
        createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000), // Last 60 days
      },
    });

    // Request posted events
    await prisma.activityEvent.create({
      data: {
        type: 'REQUEST_POSTED',
        actorId: user.id,
        targetType: 'request',
        metadata: { category: 'help' },
        isPublic: true,
        postcode: user.postcode,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    });
  }

  console.log('\n========================================');
  console.log('Demo users seed completed successfully!');
  console.log('========================================');
  console.log('\nDemo Accounts (password: Demo123!):');
  for (const userData of DEMO_USERS) {
    console.log(`  ${userData.name}: ${userData.email}`);
  }
  console.log('\nAll demo users are:');
  console.log('  - Email verified');
  console.log('  - Phone verified');
  console.log('  - ID verified');
  console.log('  - Have profile pictures');
  console.log('  - Have badges');
  console.log('  - Have active job requests');
}

main()
  .catch((e) => {
    console.error('Demo seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
