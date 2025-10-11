import { ReactNode } from "react";

interface SecondaryToolbarProps {
  children: ReactNode;
}

export const SecondaryToolbar = ({ children }: SecondaryToolbarProps) => {
  return (
    <div className="sticky top-14 z-40 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {children}
        </div>
      </div>
    </div>
  );
};
