import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, User, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

interface NavbarProps {
  userRole?: string;
  userName?: string;
  userAvatar?: string | null;
  onLogout?: () => void;
}

const roleColors = {
  Administrator: "bg-purple-100 text-purple-800",
  "Field Collection": "bg-green-100 text-green-800",
  Processing: "bg-blue-100 text-blue-800",
  Packaging: "bg-orange-100 text-orange-800",
  Labeling: "bg-pink-100 text-pink-800",
};

export const Navbar = ({ userRole = "Guest", userName = "User", userAvatar, onLogout }: NavbarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const rolePrimaryRoutes: Record<string, { path: string; label: string }> = {
    administrator: { path: "/admin", label: "Admin" },
    "field collection": { path: "/field-collection", label: "Field Collection" },
    processing: { path: "/processing", label: "Processing" },
    packaging: { path: "/packaging", label: "Packaging" },
    labeling: { path: "/labeling", label: "Labeling" },
    labelling: { path: "/labeling", label: "Labeling" },
  };

  const getBreadcrumbs = () => {
    const lowerRole = userRole?.toLowerCase?.();
    const primary = lowerRole ? rolePrimaryRoutes[lowerRole] : undefined;
    const paths = location.pathname.split("/").filter(Boolean);
    const crumbs: Array<{ label: string; path: string }> = [];

    if (primary) {
      crumbs.push(primary);
    }

    let currentPath = "";
    paths.forEach((segment) => {
      currentPath += `/${segment}`;
      const label = segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      if (primary && currentPath === primary.path) return;
      crumbs.push({ label, path: currentPath });
    });

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();
  let avatarSrc = userAvatar || undefined;
  if (!avatarSrc) {
    try {
      const saved = localStorage.getItem("auth");
      if (saved) {
        const parsed = JSON.parse(saved);
        const raw = parsed?.user?.profileImage ?? parsed?.user?.profile_image ?? null;
        if (raw) {
          avatarSrc = raw;
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (avatarSrc?.startsWith("/")) {
    const base = import.meta.env.VITE_API_URL || "";
    avatarSrc = new URL(avatarSrc, base).toString();
  }
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-gradient-to-r from-[hsl(var(--nav-gradient-start))] to-[hsl(var(--nav-gradient-end))] shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Mobile Menu */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] bg-card">
            <div className="flex flex-col gap-4 mt-8">
              <div className="pb-4 border-b">
                <p className="text-sm font-semibold">{userName}</p>
                <p className="text-xs text-muted-foreground">{userRole}</p>
              </div>
              {breadcrumbs.map((crumb) => (
                <Link
                  key={crumb.path}
                  to={crumb.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm font-medium"
                >
                  {crumb.label}
                </Link>
              ))}
              <Button
                variant="ghost"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate("/profile");
                }}
                className="justify-start"
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout?.();
                }}
                className="justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <div className="text-lg sm:text-xl font-bold text-white">Kithul Flow</div>
        </Link>

        {/* Breadcrumbs - Center (Desktop) */}
        <div className="hidden lg:flex items-center space-x-2 text-sm text-white/90 absolute left-1/2 -translate-x-1/2">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.path} className="flex items-center">
              {index > 0 && <ChevronRight className="h-4 w-4 mx-1 opacity-60" />}
              <Link
                to={crumb.path}
                className={`hover:text-white transition-colors truncate max-w-[120px] ${
                  index === breadcrumbs.length - 1 ? "font-semibold text-white" : ""
                }`}
              >
                {crumb.label}
              </Link>
            </div>
          ))}
        </div>

        {/* User Menu - Right */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <Badge variant="secondary" className="hidden sm:inline-flex bg-white/20 text-white border-white/30 text-xs">
            {userRole}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/20 hover:bg-white/30">
                <Avatar className="h-8 w-8">
                  {avatarSrc ? (
                  <AvatarImage src={avatarSrc} alt={userName} className="object-cover" />
                ) : null}
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
              <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLogout} className="text-destructive cursor-pointer">
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

