import type {
  Invite,
  InviteRequest,
  MemberHealth,
  MembershipEnriched,
  OrgLookup,
  Organization,
  OrganizationCreateRequest,
  OrganizationUpdateRequest,
  PasswordChangeRequest,
  User,
  UserUpdateRequest,
} from '@/types/api'
import { api } from './client'

export async function getOrgByJoinCode(code: string): Promise<OrgLookup> {
  const { data } = await api.get<OrgLookup>(`/api/v1/identity/organizations/by-code/${code.toUpperCase()}`)
  return data
}

export async function leaveOrganization(): Promise<void> {
  await api.post('/api/v1/identity/members/leave')
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/api/v1/identity/users/me')
  return data
}

export async function createOrganization(
  payload: OrganizationCreateRequest,
): Promise<Organization> {
  const { data } = await api.post<Organization>('/api/v1/identity/organizations', payload)
  return data
}

export async function listOrgAthletes(): Promise<User[]> {
  const { data } = await api.get<User[]>('/api/v1/identity/members/athletes')
  return data
}

export async function listOrgTrainers(): Promise<User[]> {
  const { data } = await api.get<User[]>('/api/v1/identity/members/trainers')
  return data
}

export async function getMyMemberships(): Promise<MembershipEnriched[]> {
  const { data } = await api.get<MembershipEnriched[]>('/api/v1/identity/memberships/mine')
  return data
}

export async function getOrgMemberships(): Promise<MembershipEnriched[]> {
  const { data } = await api.get<MembershipEnriched[]>('/api/v1/identity/memberships')
  return data
}

export async function getMyTrainer(): Promise<MembershipEnriched | null> {
  try {
    const { data } = await api.get<MembershipEnriched>('/api/v1/identity/members/my-trainer')
    return data
  } catch {
    return null
  }
}

export async function deleteMembership(id: string): Promise<void> {
  await api.delete(`/api/v1/identity/memberships/${id}`)
}

export async function inviteMember(payload: InviteRequest): Promise<Invite> {
  const { data } = await api.post<Invite>('/api/v1/identity/invites', payload)
  return data
}

export async function listInvites(): Promise<Invite[]> {
  const { data } = await api.get<Invite[]>('/api/v1/identity/invites')
  return data
}

export async function getMyInvites(): Promise<Invite[]> {
  const { data } = await api.get<Invite[]>('/api/v1/identity/invites/mine')
  return data
}

export async function acceptInvite(id: string): Promise<void> {
  await api.post(`/api/v1/identity/invites/${id}/accept`)
}

export async function declineInvite(id: string): Promise<void> {
  await api.post(`/api/v1/identity/invites/${id}/decline`)
}

export async function deleteInvite(id: string): Promise<void> {
  await api.delete(`/api/v1/identity/invites/${id}`)
}

export async function updateMe(payload: UserUpdateRequest): Promise<User> {
  const { data } = await api.patch<User>('/api/v1/identity/users/me', payload)
  return data
}

export async function changePassword(payload: PasswordChangeRequest): Promise<void> {
  await api.post('/api/v1/identity/users/me/password', payload)
}

export async function getMyOrganization(): Promise<Organization> {
  const { data } = await api.get<Organization>('/api/v1/identity/organizations/current')
  return data
}

export async function updateMyOrganization(
  payload: OrganizationUpdateRequest,
): Promise<Organization> {
  const { data } = await api.patch<Organization>(
    '/api/v1/identity/organizations/current',
    payload,
  )
  return data
}

export async function removeTrainer(userId: string): Promise<void> {
  await api.delete(`/api/v1/identity/members/trainers/${userId}`)
}

export async function getMemberHealth(): Promise<MemberHealth[]> {
  const { data } = await api.get<MemberHealth[]>(
    '/api/v1/identity/organizations/current/member-health',
  )
  return data
}
