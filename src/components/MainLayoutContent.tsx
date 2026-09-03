"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { PillNav } from "@/components/ui/PillNav";

export function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const { user, can } = useAuth();

  const content = !isLoginPage && user && !can("view") ? (
    <section className="mx-auto flex min-h-[70dvh] w-full max-w-xl items-center justify-center px-5 py-12">
      <div className="w-full border-y border-slate-200 py-10 text-center dark:border-white/10">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-500" />
        <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">ยังไม่มีสิทธิ์ดูข้อมูล</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          บัญชีนี้เข้าถึงระบบได้ แต่ยังไม่ได้รับ View Permission กรุณาติดต่อผู้ดูแลระบบ
        </p>
      </div>
    </section>
  ) : children;

  return (
    <>
      {!isLoginPage && <PillNav />}
      <main className="flex-1 w-full min-w-0 overflow-x-hidden overflow-y-auto">
        {content}
      </main>
    </>
  );
}
