import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ReactNode } from 'react';
import { UserRights } from '@/types/user';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRight?: keyof UserRights;
}

export function ProtectedRoute({ children, requiredRight }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, getUserRights } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  // Check generic right if specified
  if (requiredRight && user) {
    const rights = getUserRights(user);
    const rightValue = rights[requiredRight];

    // access denied if 'no'
    if (rightValue === 'no') {
      const { getLandingPage } = useAuth();
      const landingPage = getLandingPage(user);

      // If we are already at the landing page and still 'no', then show error
      // (This prevents infinite redirect loops)
      if (window.location.pathname === landingPage) {
        return (
          <div className="min-h-screen flex items-center justify-center flex-col gap-4">
            <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
            <p className="text-muted-foreground">You do not have permission to view any pages in the system. Please contact an administrator.</p>
          </div>
        );
      }

      return <Navigate to={landingPage} replace />;
    }
  }

  return <>{children}</>;
}
