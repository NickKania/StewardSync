import { Id } from '@convex/_generated/dataModel';

export type RoleName = 'driver' | 'steward' | 'head_steward' | 'event_manager' | 'league_manager';

export interface Role {
  _id: Id<'roles'>;
  name: RoleName;
  displayName: string;
}

export interface User {
  _id: Id<'users'>;
  email?: string;
  name: string;
  avatarUrl?: string;
  roleId: Id<'roles'>;
  role?: Role;
  discordId?: string;
  discordUsername?: string;
  discordGlobalName?: string;
  officialName?: string;
  createdAt: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
}
