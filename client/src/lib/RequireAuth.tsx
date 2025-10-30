import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { token, hydrated } = useAuth();
  const location = useLocation();

  if (!hydrated) {
    return null;
  }

  if (!token) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  return children;
}
