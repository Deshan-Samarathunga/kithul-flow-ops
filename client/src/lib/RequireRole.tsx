import { Navigate } from "react-router-dom";
import { useAuth } from "./auth";

export default function RequireRole({ allow, children }: { allow: string[]; children: JSX.Element }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  const userRole = String(user.role || "").toLowerCase();
  const allowedRoles = allow.map(r => r.toLowerCase());
  
  if (!allowedRoles.includes(userRole)) {
    // Redirect to user's appropriate page based on their role
    const roleRoutes: Record<string, string> = {
      "administrator": "/admin",
      "field collection": "/field-collection", 
      "processing": "/processing",
      "packaging": "/packaging",
      "labeling": "/labeling"
    };
    
    const redirectTo = roleRoutes[userRole] || "/profile";
    return <Navigate to={redirectTo} replace />;
  }
  
  return children;
}


