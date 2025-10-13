import { ReactNode } from "react";

interface SecondaryToolbarProps {
  children: ReactNode;
}

export const SecondaryToolbar = ({ children }: SecondaryToolbarProps) => {
  return (
    <div className="sticky top-16 z-40 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          {children}
        </div>
      </div>
    </div>
  );
};
