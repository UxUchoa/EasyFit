import { notFound, redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth/session';
import { isStaffRole } from './policy';

export async function requireStaff() {
  const session = await getCurrentSession();
  if (!session) redirect('/entrar');
  if (!isStaffRole(session.user.role)) notFound();
  return session;
}

