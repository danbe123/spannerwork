import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = 'danielbenson1988@gmail.com';
const dollar = String.fromCharCode(36);

try {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (user) {
    console.log('FOUND', user);
  } else {
    console.log('NOT_FOUND');
  }
} finally {
  await prisma[dollar + 'disconnect']();
}
