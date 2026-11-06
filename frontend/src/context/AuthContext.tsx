import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { AUTH_UNAUTHORIZED_EVENT, apiClient } from '../lib/api-client';
import { queryClient } from '../lib/query-client';

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};

function persistToken(token: string | null) {
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
  api.setAuthToken(token);
  apiClient.setAuthToken(token);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken'));
  const navigate = useNavigate();
  const location = useLocation();

  const postAuthRedirect = () => {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    const dest = from && from !== '/login' && from !== '/register' ? from : '/';
    navigate(dest, { replace: true });
  };

  const logout = () => {
    persistToken(null);
    setToken(null);
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    persistToken(token);
  }, [token]);

  useEffect(() => {
    const onUnauthorized = () => {
      persistToken(null);
      setToken(null);
      queryClient.clear();
      navigate('/login', { replace: true });
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [navigate]);

  const login = async (email: string, password: string) => {
    const result = await api.auth.login({ email, password });
    persistToken(result.token);
    setToken(result.token);
    postAuthRedirect();
  };

  const register = async (fullName: string, email: string, phone: string, password: string) => {
    const result = await api.auth.register({ fullName, email, phone, password });
    persistToken(result.token);
    setToken(result.token);
    postAuthRedirect();
  };

  const value: AuthContextValue = {
    token,
    isAuthenticated: !!token,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
