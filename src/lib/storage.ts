import { TokenManager } from './tokenManager';

export function getAuthToken(type: 'access' | 'refresh'): string | null {
  return type === 'access' ? TokenManager.getAccessToken() ?? null : TokenManager.getRefreshToken() ?? null;
}

export function setAuthTokens(access: string, refresh: string) {
  TokenManager.setTokens(access, refresh);
}

export function removeAuthTokens() {
  TokenManager.clearTokens();
}

export function setStoredEmail(email: string) {
  TokenManager.setEmail(email);
}

export function getStoredEmail(): string | null {
  return TokenManager.getEmail();
}
