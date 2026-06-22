import { prisma } from '../prisma';

export async function getOwnedProvider(userId: string) {
  return prisma.provider.findUnique({ where: { userId } });
}