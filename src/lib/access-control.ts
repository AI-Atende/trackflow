import { prisma } from '@/lib/prisma';

/**
 * Verifies if the session user has access to the target account.
 * Access is granted if:
 * 1. The session user IS the target account owner.
 * 2. The session user has an ACCEPTED invite from the target account owner.
 *
 * @param sessionUserId The ID of the authenticated user.
 * @param targetAccountId The ID of the account to access.
 * @returns boolean
 */
export async function verifyAccountAccess(
  sessionUserId: string,
  targetAccountId: string,
): Promise<boolean> {
  if (sessionUserId === targetAccountId) return true;

  const invite = await prisma.accountInvite.findFirst({
    where: {
      ownerId: targetAccountId,
      guestId: sessionUserId,
      status: 'ACCEPTED',
    },
  });

  return !!invite;
}
