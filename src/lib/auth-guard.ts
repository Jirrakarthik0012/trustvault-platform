import type { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AuthenticatedUser = {
  id: string;
  organizationId: string;
  role: Role;
  email: string;
  name: string;
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.organizationId || !session.user.role) return null;
  // Use the live membership record instead of trusting role claims for the full JWT lifetime.
  const current = await prisma.user.findFirst({
    where: { id: session.user.id, organizationId: session.user.organizationId },
    select: { id: true, organizationId: true, role: true, email: true, name: true }
  });
  if (!current) return null;
  return {
    id: current.id,
    organizationId: current.organizationId,
    role: current.role,
    email: current.email,
    name: current.name
  };
}

export function hasRole(user: AuthenticatedUser, roles: readonly Role[]) {
  return roles.includes(user.role);
}
