import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import useAuth from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

interface RequireAdminProps {
  children: ReactNode;
}

/**
 * RequireAdmin component - ensures user is authenticated AND has admin role
 * Redirects to Feed if user is logged in but not admin
 * Redirects to Profile/login if not authenticated
 */
export default function RequireAdmin({ children }: RequireAdminProps): JSX.Element {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-800" />
      </div>
    );
  }

  if (!user) {
    const redirectPath = `${location.pathname}${location.search || ""}`;
    const encodedRedirect = encodeURIComponent(redirectPath);
    return <Navigate to={`/profile?redirect=${encodedRedirect}`} replace />;
  }

  // Check for admin role
  if (user.role !== 'ADMIN') {
    return <Navigate to="/feed" replace />;
  }

  return <>{children}</>;
}
