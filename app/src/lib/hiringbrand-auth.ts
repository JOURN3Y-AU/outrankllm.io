/**
 * HiringBrand auth helpers for API routes
 * Wraps existing auth.ts with organization-aware checks
 */

import { getSession, type Session } from '@/lib/auth'
import {
  getOrganizationForUser,
  getUserRole,
  type Organization,
  type MemberRole,
} from '@/lib/organization'

export interface HBSessionContext {
  session: Session
  org: Organization
  role: MemberRole
}

/**
 * Require a valid HiringBrand session with org membership.
 * Throws if not authenticated or not in an organization.
 */
export async function requireHBSession(): Promise<HBSessionContext> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }

  const org = await getOrganizationForUser(session.lead_id)
  if (!org) {
    throw new Error('No organization found')
  }

  const role = await getUserRole(session.lead_id)
  if (!role) {
    throw new Error('No role found')
  }

  return { session, org, role }
}

/**
 * Require admin-level access (owner or admin).
 * Throws if not authenticated, not in an org, or is a viewer.
 */
export async function requireHBAdmin(): Promise<HBSessionContext> {
  const ctx = await requireHBSession()

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    throw new Error('Admin access required')
  }

  return ctx
}

/**
 * Require owner-level access to the organization.
 * Throws if not authenticated, not in an org, or not the owner.
 */
export async function requireHBOwner(): Promise<HBSessionContext> {
  const ctx = await requireHBSession()

  if (ctx.role !== 'owner') {
    throw new Error('Owner access required')
  }

  return ctx
}
