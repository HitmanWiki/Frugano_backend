const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create default printer config
  await prisma.hardwareConfig.upsert({
    where: { id: 'default-printer' },
    update: {},
    create: {
      id: 'default-printer',
      deviceType: 'THERMAL_PRINTER',
      deviceName: 'Default Thermal Printer',
      connectionType: 'USB',
      isDefault: true,
      isActive: true,
      createdById: (await prisma.user.findFirst()).id
    }
  });

  // Create default weighing machine config
  await prisma.hardwareConfig.upsert({
    where: { id: 'default-scale' },
    update: {},
    create: {
      id: 'default-scale',
      deviceType: 'WEIGHING_MACHINE',
      deviceName: 'Default Weighing Scale',
      connectionType: 'USB',
      isActive: true,
      createdById: (await prisma.user.findFirst()).id
    }
  });

  console.log('✅ Default hardware configured');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());