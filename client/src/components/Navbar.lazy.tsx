import { Suspense, lazy } from "react";
import type { NavbarProps } from "@/components/Navbar";

const NavbarComponent = lazy(() => import("@/components/Navbar").then((module) => ({
  default: module.Navbar,
})));

const NavbarFallback = () => (
  <div className="sticky top-0 z-50 w-full border-b bg-background/80">
    <div className="mx-auto h-16 max-w-screen-xl animate-pulse px-4 sm:px-6" />
  </div>
);

export const Navbar = (props: NavbarProps) => (
  <Suspense fallback={<NavbarFallback />}>
    <NavbarComponent {...props} />
  </Suspense>
);

export type { NavbarProps };
