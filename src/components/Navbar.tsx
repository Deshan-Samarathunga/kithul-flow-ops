import { Link, useLocation } from "react-router-dom";
import { ChevronRight, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface NavbarProps {
  userRole?: string;
  userName?: string;
  onLogout?: () => void;
}

const roleColors = {
  Administrator: "bg-purple-100 text-purple-800",
  "Field Collection": "bg-green-100 text-green-800",
  Processing: "bg-blue-100 text-blue-800",
  Packaging: "bg-orange-100 text-orange-800",
  Labeling: "bg-pink-100 text-pink-800",
};

export const Navbar = ({ userRole = "Guest", userName = "User", onLogout }: NavbarProps) => {
  const location = useLocation();
  
  const getBreadcrumbs = () => {
    const paths = location.pathname.split("/").filter(Boolean);
    const crumbs = [{ label: "Home", path: "/" }];
    
    let currentPath = "";
    paths.forEach((segment) => {
      currentPath += `/${segment}`;
      const label = segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      crumbs.push({ label, path: currentPath });
    });
    
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-gradient-to-r from-[hsl(var(--nav-gradient-start))] to-[hsl(var(--nav-gradient-end))] shadow-sm">
      <div className="container mx-auto flex h-14 items-center justify-between px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <div className="text-xl font-bold text-white">Kithul Flow</div>
        </Link>

        {/* Breadcrumbs - Center */}
        <div className="hidden md:flex items-center space-x-2 text-sm text-white/90">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.path} className="flex items-center">
              {index > 0 && <ChevronRight className="h-4 w-4 mx-1 opacity-60" />}
              <Link
                to={crumb.path}
                className={`hover:text-white transition-colors ${
                  index === breadcrumbs.length - 1 ? "font-semibold text-white" : ""
                }`}
              >
                {crumb.label}
              </Link>
            </div>
          ))}
        </div>

        {/* User Menu - Right */}
        <div className="flex items-center space-x-3">
          <Badge variant="secondary" className="hidden sm:inline-flex bg-white/20 text-white border-white/30">
            {userRole}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-9 rounded-full bg-white/20 hover:bg-white/30">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-white text-primary text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card">
              <div className="px-2 py-2 border-b">
                <p className="text-sm font-semibold">{userName}</p>
                <p className="text-xs text-muted-foreground">{userRole}</p>
              </div>
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};
