// AuthContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    try {
      const result = await api.auth.login({ email, password });
      setToken(result.token);
      // after login redirect to dashboard (or home)
      navigate('/', { replace: true });
    } catch (err) {
      // rethrow so UI can show error
      throw err;
    }
  };

  const register = async (fullName: string, email: string, phone: string, password: string) => {
    try {
      const result = await api.auth.register({ fullName, email, phone, password });
      setToken(result.token);
      navigate('/', { replace: true });
    } catch (err) {
      throw err;
    }
  };

  const logout = () => {
    setToken(null);
    navigate('/login', { replace: true });
  };

  const value: AuthContextValue = {
    token,
    isAuthenticated: !!token,
    login,
    register,
    logout,
  };

  // expose token to api module via setter (api.setAuthToken)
  api.setAuthToken(token);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
