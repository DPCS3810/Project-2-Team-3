import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface Props {
  children: ReactNode;
  loading?: boolean;
}

export function ProtectedRoute({ children, loading }: Props) {
  const { user } = useAuth();

  if (loading) {
    return <div className="page-status">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
