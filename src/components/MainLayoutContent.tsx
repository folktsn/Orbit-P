"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { PillNav } from "@/components/ui/PillNav";

export function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <>
      {!isLoginPage && <PillNav />}
      <main className="flex-1 w-full min-w-0 overflow-x-hidden overflow-y-auto">
        {children}
      </main>
    </>
  );
}
