export type MemberRole = 'owner' | 'admin' | 'agent';
export type MemberStatus = 'invited' | 'active' | 'suspended' | 'removed';

export type TeamMember = {
  id: string;
  fullName: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  teamName: string | null;
  imageUrl?: string;
};

const STORAGE_KEY = 'orarepot.members';

const SEED: TeamMember[] = [
  {
    id: 'mem_owner',
    fullName: 'Dio',
    email: 'hello@orarepot.com',
    role: 'owner',
    status: 'active',
    teamName: null,
  },
];

function readMembers(): TeamMember[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      return SEED;
    }
    return JSON.parse(raw) as TeamMember[];
  } catch {
    return SEED;
  }
}

function writeMembers(rows: TeamMember[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function getMembers(): TeamMember[] {
  return readMembers().filter((row) => row.status !== 'removed');
}

export function countByRole(rows: TeamMember[]) {
  return {
    all: rows.length,
    owner: rows.filter((row) => row.role === 'owner').length,
    admin: rows.filter((row) => row.role === 'admin').length,
    agent: rows.filter((row) => row.role === 'agent').length,
  };
}

export function inviteMember(input: {
  fullName: string;
  email: string;
  role: Exclude<MemberRole, 'owner'>;
  teamName: string | null;
}): TeamMember {
  const row: TeamMember = {
    id: `mem_${Date.now()}`,
    fullName: input.fullName.trim() || input.email.split('@')[0],
    email: input.email.trim().toLowerCase(),
    role: input.role,
    status: 'invited',
    teamName: input.teamName,
  };
  writeMembers([row, ...getMembers()]);
  return row;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
