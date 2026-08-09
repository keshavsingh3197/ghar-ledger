export type Role = 'Admin' | 'Editor' | 'Viewer';

export interface UserProfile {
  id: string;
  email: string;
  username?: string | null;
  displayName: string;
  roles: Role[];
}

/** Returned by the IdP's POST /sso/session — the refresh token lives only in the shared SSO cookie. */
export interface SsoSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: UserProfile;
}
