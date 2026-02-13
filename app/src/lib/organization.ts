/**
 * Organization management for HiringBrand.io
 * Organizations are the billing entity with team members and monitored domains
 */

import { createServiceClient } from '@/lib/supabase/server'

// ============================================
// TYPES
// ============================================

export type OrganizationTier = 'brand' | 'agency_10' | 'agency_20' | 'enterprise'
export type OrganizationStatus = 'active' | 'past_due' | 'canceled' | 'incomplete'
export type MemberRole = 'owner' | 'admin' | 'viewer'

export interface Organization {
  id: string
  name: string
  brand: string
  tier: OrganizationTier
  domain_limit: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  status: OrganizationStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  lead_id: string
  role: MemberRole
  invited_at: string
  joined_at: string | null
}

export interface OrganizationInvite {
  id: string
  organization_id: string
  email: string
  invited_by: string | null
  role: MemberRole
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export interface MonitoredDomain {
  id: string
  organization_id: string
  domain: string
  company_name: string | null
  is_primary: boolean
  added_by: string | null
  created_at: string
}

export interface CreateOrganizationInput {
  name: string
  tier?: OrganizationTier
  stripe_customer_id?: string
}

export interface UpdateOrganizationInput {
  name?: string
  tier?: OrganizationTier
  domain_limit?: number
  stripe_customer_id?: string
  stripe_subscription_id?: string
  stripe_price_id?: string
  status?: OrganizationStatus
  current_period_start?: string
  current_period_end?: string
  cancel_at_period_end?: boolean
}

// Tier to domain limit mapping
export const TIER_DOMAIN_LIMITS: Record<OrganizationTier, number> = {
  brand: 1,
  agency_10: 10,
  agency_20: 20,
  enterprise: 100, // custom, but need a default
}

// ============================================
// ORGANIZATION CRUD
// ============================================

/**
 * Create a new organization
 */
export async function createOrganization(
  input: CreateOrganizationInput,
  ownerLeadId: string
): Promise<Organization | null> {
  const supabase = createServiceClient()

  const tier = input.tier || 'brand'
  const domainLimit = TIER_DOMAIN_LIMITS[tier]

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: input.name,
      tier,
      domain_limit: domainLimit,
      stripe_customer_id: input.stripe_customer_id,
      status: 'incomplete', // Will become 'active' after payment
    })
    .select()
    .single()

  if (orgError || !org) {
    console.error('Error creating organization:', orgError)
    return null
  }

  // Add owner as member
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: org.id,
      lead_id: ownerLeadId,
      role: 'owner',
      joined_at: new Date().toISOString(),
    })

  if (memberError) {
    console.error('Error adding owner to organization:', memberError)
    // Clean up the org if we couldn't add the owner
    await supabase.from('organizations').delete().eq('id', org.id)
    return null
  }

  return org
}

/**
 * Get an organization by ID
 */
export async function getOrganizationById(orgId: string): Promise<Organization | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching organization:', error)
    }
    return null
  }

  return data
}

/**
 * Get an organization by Stripe subscription ID
 */
export async function getOrganizationByStripeId(stripeSubscriptionId: string): Promise<Organization | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching organization by Stripe ID:', error)
    }
    return null
  }

  return data
}

/**
 * Get an organization by Stripe customer ID
 */
export async function getOrganizationByStripeCustomerId(stripeCustomerId: string): Promise<Organization | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('stripe_customer_id', stripeCustomerId)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching organization by Stripe customer ID:', error)
    }
    return null
  }

  return data
}

/**
 * Update an organization
 */
export async function updateOrganization(
  orgId: string,
  input: UpdateOrganizationInput
): Promise<Organization | null> {
  const supabase = createServiceClient()

  // If tier is changing, update domain_limit too
  const updates: UpdateOrganizationInput = { ...input }
  if (input.tier && !input.domain_limit) {
    updates.domain_limit = TIER_DOMAIN_LIMITS[input.tier]
  }

  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId)
    .select()
    .single()

  if (error) {
    console.error('Error updating organization:', error)
    return null
  }

  return data
}

/**
 * Update an organization by Stripe subscription ID
 */
export async function updateOrganizationByStripeId(
  stripeSubscriptionId: string,
  input: UpdateOrganizationInput
): Promise<Organization | null> {
  const supabase = createServiceClient()

  const updates: UpdateOrganizationInput = { ...input }
  if (input.tier && !input.domain_limit) {
    updates.domain_limit = TIER_DOMAIN_LIMITS[input.tier]
  }

  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .select()
    .single()

  if (error) {
    console.error('Error updating organization by Stripe ID:', error)
    return null
  }

  return data
}

// ============================================
// MEMBER MANAGEMENT
// ============================================

/**
 * Get the organization for a user (lead)
 */
export async function getOrganizationForUser(leadId: string): Promise<Organization | null> {
  const supabase = createServiceClient()

  const { data: membership, error } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('lead_id', leadId)
    .single()

  if (error || !membership) {
    if (error?.code !== 'PGRST116') {
      console.error('Error fetching user organization:', error)
    }
    return null
  }

  return getOrganizationById(membership.organization_id)
}

/**
 * Get user's role in their organization
 */
export async function getUserRole(leadId: string): Promise<MemberRole | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('lead_id', leadId)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching user role:', error)
    }
    return null
  }

  return data?.role as MemberRole
}

/**
 * Check if user is organization owner
 */
export async function isOrganizationOwner(leadId: string, orgId?: string): Promise<boolean> {
  const supabase = createServiceClient()

  let query = supabase
    .from('organization_members')
    .select('role')
    .eq('lead_id', leadId)
    .eq('role', 'owner')

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return false
  }

  return true
}

/**
 * Get all members of an organization
 */
export async function getOrganizationMembers(orgId: string): Promise<Array<OrganizationMember & { email: string }>> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('organization_members')
    .select(`
      *,
      leads!inner (
        email
      )
    `)
    .eq('organization_id', orgId)
    .order('joined_at', { ascending: true })

  if (error) {
    console.error('Error fetching organization members:', error)
    return []
  }

  return (data || []).map((m: { leads: { email: string } } & OrganizationMember) => ({
    ...m,
    email: m.leads?.email || '',
  }))
}

/**
 * Add a member to an organization (after accepting invite)
 */
export async function addOrganizationMember(
  orgId: string,
  leadId: string,
  role: MemberRole = 'viewer'
): Promise<OrganizationMember | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('organization_members')
    .insert({
      organization_id: orgId,
      lead_id: leadId,
      role,
      joined_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding organization member:', error)
    return null
  }

  return data
}

/**
 * Remove a member from an organization
 */
export async function removeOrganizationMember(orgId: string, leadId: string, requestingRole?: MemberRole): Promise<boolean> {
  const supabase = createServiceClient()

  // Can't remove the owner
  const targetRole = await getUserRole(leadId)
  if (targetRole === 'owner') {
    console.error('Cannot remove organization owner')
    return false
  }

  // Admin can only remove viewers
  if (requestingRole === 'admin' && targetRole !== 'viewer') {
    console.error('Admin can only remove viewers')
    return false
  }

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('organization_id', orgId)
    .eq('lead_id', leadId)

  if (error) {
    console.error('Error removing organization member:', error)
    return false
  }

  return true
}

/**
 * Update a member's role (owner only — cannot change owner or promote to owner)
 */
export async function updateMemberRole(
  orgId: string,
  targetLeadId: string,
  newRole: MemberRole
): Promise<boolean> {
  const supabase = createServiceClient()

  // Cannot promote to owner
  if (newRole === 'owner') {
    console.error('Cannot promote to owner')
    return false
  }

  // Cannot change the owner's role
  const currentRole = await getUserRole(targetLeadId)
  if (currentRole === 'owner') {
    console.error('Cannot change owner role')
    return false
  }

  const { error } = await supabase
    .from('organization_members')
    .update({ role: newRole })
    .eq('organization_id', orgId)
    .eq('lead_id', targetLeadId)

  if (error) {
    console.error('Error updating member role:', error)
    return false
  }

  return true
}

// ============================================
// INVITE MANAGEMENT
// ============================================

/**
 * Create an invitation
 */
export async function createInvite(
  orgId: string,
  email: string,
  invitedBy: string,
  role: MemberRole = 'viewer'
): Promise<OrganizationInvite | null> {
  const supabase = createServiceClient()

  // Check if already invited
  const { data: existing } = await supabase
    .from('organization_invites')
    .select('id')
    .eq('organization_id', orgId)
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)
    .single()

  if (existing) {
    console.error('User already invited')
    return null
  }

  const { data, error } = await supabase
    .from('organization_invites')
    .insert({
      organization_id: orgId,
      email: email.toLowerCase(),
      invited_by: invitedBy,
      role,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating invite:', error)
    return null
  }

  return data
}

/**
 * Get an invite by token
 */
export async function getInviteByToken(token: string): Promise<OrganizationInvite | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('organization_invites')
    .select('*')
    .eq('token', token)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching invite:', error)
    }
    return null
  }

  return data
}

/**
 * Get pending invites for an organization
 */
export async function getPendingInvites(orgId: string): Promise<OrganizationInvite[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('organization_invites')
    .select('*')
    .eq('organization_id', orgId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching pending invites:', error)
    return []
  }

  return data || []
}

/**
 * Accept an invitation
 */
export async function acceptInvite(token: string, leadId: string): Promise<boolean> {
  const supabase = createServiceClient()

  // Get the invite
  const invite = await getInviteByToken(token)
  if (!invite) {
    console.error('Invite not found')
    return false
  }

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    console.error('Invite expired')
    return false
  }

  // Check if already accepted
  if (invite.accepted_at) {
    console.error('Invite already accepted')
    return false
  }

  // Check if user is already in an org
  const existingOrg = await getOrganizationForUser(leadId)
  if (existingOrg) {
    console.error('User already in an organization')
    return false
  }

  // Add as member with the role specified in the invite
  const member = await addOrganizationMember(invite.organization_id, leadId, (invite.role as MemberRole) || 'viewer')
  if (!member) {
    return false
  }

  // Mark invite as accepted
  const { error } = await supabase
    .from('organization_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  if (error) {
    console.error('Error marking invite accepted:', error)
    // Member was added, so still return true
  }

  return true
}

/**
 * Cancel/delete an invitation
 */
export async function cancelInvite(inviteId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('organization_invites')
    .delete()
    .eq('id', inviteId)

  if (error) {
    console.error('Error canceling invite:', error)
    return false
  }

  return true
}

// ============================================
// DOMAIN MANAGEMENT
// ============================================

/**
 * Get all monitored domains for an organization
 */
export async function getMonitoredDomains(orgId: string): Promise<MonitoredDomain[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('monitored_domains')
    .select('*')
    .eq('organization_id', orgId)
    .order('is_primary', { ascending: false }) // Primary first
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching monitored domains:', error)
    return []
  }

  return data || []
}

/**
 * Get primary domain count for an organization
 */
export async function getPrimaryDomainCount(orgId: string): Promise<number> {
  const supabase = createServiceClient()

  const { count, error } = await supabase
    .from('monitored_domains')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('is_primary', true)

  if (error) {
    console.error('Error counting primary domains:', error)
    return 0
  }

  return count || 0
}

/**
 * Check if organization can add another primary domain
 */
export async function canAddPrimaryDomain(orgId: string): Promise<boolean> {
  const org = await getOrganizationById(orgId)
  if (!org) return false

  const currentCount = await getPrimaryDomainCount(orgId)
  return currentCount < org.domain_limit
}

/**
 * Add a monitored domain
 */
export async function addMonitoredDomain(
  orgId: string,
  domain: string,
  options: {
    companyName?: string
    isPrimary?: boolean
    addedBy?: string
  } = {}
): Promise<MonitoredDomain | null> {
  const supabase = createServiceClient()

  const isPrimary = options.isPrimary !== false // Default to true

  // Check limit if adding primary
  if (isPrimary) {
    const canAdd = await canAddPrimaryDomain(orgId)
    if (!canAdd) {
      console.error('Organization has reached primary domain limit')
      return null
    }
  }

  const { data, error } = await supabase
    .from('monitored_domains')
    .insert({
      organization_id: orgId,
      domain: domain.toLowerCase(),
      company_name: options.companyName,
      is_primary: isPrimary,
      added_by: options.addedBy,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding monitored domain:', error)
    return null
  }

  return data
}

/**
 * Update a monitored domain
 */
export async function updateMonitoredDomain(
  domainId: string,
  updates: { company_name?: string; is_primary?: boolean }
): Promise<MonitoredDomain | null> {
  const supabase = createServiceClient()

  // If making primary, check limit
  if (updates.is_primary === true) {
    const { data: domain } = await supabase
      .from('monitored_domains')
      .select('organization_id, is_primary')
      .eq('id', domainId)
      .single()

    if (domain && !domain.is_primary) {
      const canAdd = await canAddPrimaryDomain(domain.organization_id)
      if (!canAdd) {
        console.error('Organization has reached primary domain limit')
        return null
      }
    }
  }

  const { data, error } = await supabase
    .from('monitored_domains')
    .update(updates)
    .eq('id', domainId)
    .select()
    .single()

  if (error) {
    console.error('Error updating monitored domain:', error)
    return null
  }

  return data
}

/**
 * Remove a monitored domain
 */
export async function removeMonitoredDomain(domainId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('monitored_domains')
    .delete()
    .eq('id', domainId)

  if (error) {
    console.error('Error removing monitored domain:', error)
    return false
  }

  return true
}

/**
 * Get a specific monitored domain by domain name within an org
 */
export async function getMonitoredDomainByName(
  orgId: string,
  domain: string
): Promise<MonitoredDomain | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('monitored_domains')
    .select('*')
    .eq('organization_id', orgId)
    .eq('domain', domain.toLowerCase())
    .single()

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching monitored domain:', error)
    }
    return null
  }

  return data
}
