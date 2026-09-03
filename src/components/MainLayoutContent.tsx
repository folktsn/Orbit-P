"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { PillNav } from "@/components/ui/PillNav";
import { PAGE_DEFINITIONS, pageKeyForPath } from "@/lib/permissions";

export function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const { user, can, canPage } = useAuth();
  const pageKey = pageKeyForPath(pathname);
  const deniedPage = pageKey && !canPage(pageKey);

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
  ) : !isLoginPage && deniedPage ? (
    <section className="mx-auto max-w-2xl px-5 py-16 text-center">
      <ShieldAlert className="mx-auto h-8 w-8 text-amber-500" />
      <h1 className="mt-4 text-lg font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
      <p className="mt-2 text-sm text-slate-500">กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</p>
      <nav aria-label="หน้าที่เข้าถึงได้" className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-3">
        {PAGE_DEFINITIONS.filter(({ key }) => canPage(key)).map((page) => <Link key={page.key} href={page.href} className="text-sm font-medium text-sky-600 hover:underline">{page.name}</Link>)}
      </nav>
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
