// RequireAuth.tsx – protects routes from unauthenticated access
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Wraps a protected route. If the user is not authenticated it redirects to
 * /login while preserving the location that the user attempted to visit.
 */
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login page, preserving the intended destination
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};
