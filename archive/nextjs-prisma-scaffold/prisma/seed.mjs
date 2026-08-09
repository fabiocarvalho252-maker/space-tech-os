import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes, scryptSync } from 'node:crypto';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = 'admin@spacetech.com.br';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Administrador',
      role: 'ADMIN',
      password: hashPassword('spacetech123'),
    },
  });

  const parts = [
    { name: 'Tela iPhone 11', sku: 'TEL-IP11', brand: 'Apple', costPriceCents: 35000, salePriceCents: 55000, stockQuantity: 8, minStockQuantity: 2 },
    { name: 'Tela iPhone 13', sku: 'TEL-IP13', brand: 'Apple', costPriceCents: 60000, salePriceCents: 95000, stockQuantity: 5, minStockQuantity: 2 },
    { name: 'Bateria iPhone 11', sku: 'BAT-IP11', brand: 'Apple', costPriceCents: 9000, salePriceCents: 18000, stockQuantity: 12, minStockQuantity: 3 },
    { name: 'Conector de carga Samsung S21', sku: 'CON-S21', brand: 'Samsung', costPriceCents: 4000, salePriceCents: 9000, stockQuantity: 10, minStockQuantity: 3 },
    { name: 'Tela Samsung A54', sku: 'TEL-A54', brand: 'Samsung', costPriceCents: 42000, salePriceCents: 68000, stockQuantity: 6, minStockQuantity: 2 },
    { name: 'Câmera traseira iPhone 12', sku: 'CAM-IP12', brand: 'Apple', costPriceCents: 25000, salePriceCents: 42000, stockQuantity: 4, minStockQuantity: 1 },
    { name: 'Alto-falante genérico', sku: 'ALT-GEN', brand: 'Genérico', costPriceCents: 3000, salePriceCents: 7000, stockQuantity: 20, minStockQuantity: 5 },
    { name: 'Película de vidro 3D', sku: 'PEL-3D', brand: 'Genérico', costPriceCents: 800, salePriceCents: 2500, stockQuantity: 50, minStockQuantity: 10 },
  ];

  for (const part of parts) {
    await prisma.part.upsert({
      where: { sku: part.sku },
      update: {},
      create: part,
    });
  }

  console.log('Seed concluído: usuário admin (admin@spacetech.com.br / spacetech123) e peças de estoque.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
