import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import useAuth from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

interface RequireAuthProps {
  children: ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps): JSX.Element {
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

  return <>{children}</>;
}
