import Cookies from 'js-cookie';

const isProd = process.env.NODE_ENV === 'production';
const ACCESS_KEY = 'org_access_token';
const REFRESH_KEY = 'org_refresh_token';
const EMAIL_KEY = 'org_email';

export const TokenManager = {
  getAccessToken: () => {
    if (typeof window === 'undefined') return null;
    return isProd ? Cookies.get(ACCESS_KEY) : localStorage.getItem(ACCESS_KEY);
  },

  getRefreshToken: () => {
    if (typeof window === 'undefined') return null;
    return isProd ? Cookies.get(REFRESH_KEY) : localStorage.getItem(REFRESH_KEY);
  },

  setTokens: (access: string, refresh: string) => {
    if (typeof window === 'undefined') return;
    if (isProd) {
      Cookies.set(ACCESS_KEY, access, { expires: 365, secure: true, sameSite: 'strict' });
      Cookies.set(REFRESH_KEY, refresh, { expires: 365, secure: true, sameSite: 'strict' });
    } else {
      localStorage.setItem(ACCESS_KEY, access);
      localStorage.setItem(REFRESH_KEY, refresh);
    }
  },

  clearTokens: () => {
    if (typeof window === 'undefined') return;
    if (isProd) {
      Cookies.remove(ACCESS_KEY);
      Cookies.remove(REFRESH_KEY);
    } else {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(EMAIL_KEY);
    }
  },

  setEmail: (email: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(EMAIL_KEY, email);
  },
  getEmail: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(EMAIL_KEY);
  },
};
