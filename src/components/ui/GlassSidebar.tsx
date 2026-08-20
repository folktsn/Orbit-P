"use client";

import { motion } from "framer-motion";
import { LayoutDashboard, Users, Briefcase, UserCheck, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { name: "แดชบอร์ด", href: "/", icon: LayoutDashboard },
  { name: "กำลังคน", href: "/manpower", icon: Users },
  { name: "ระบบสรรหา", href: "/ats", icon: Briefcase },
  { name: "การประเมิน", href: "/probation", icon: UserCheck },
];

export function GlassSidebar() {
  const pathname = usePathname();

  return (
    <motion.aside
      initial={{ x: -250 }}
      animate={{ x: 0 }}
      className="w-64 h-full bg-black border-r border-r-white/20 flex flex-col pt-8 pb-4"
    >
      <div className="px-6 mb-10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-none bg-white flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-black" />
        </div>
        <h1 className="text-xl font-semibold tracking-wide">OrbitHire</h1>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-none transition-all duration-300 border-l-2",
                isActive
                  ? "bg-white/5 text-white border-white"
                  : "text-slate-400 border-transparent hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-500")} />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-6">
        <div className="border border-white/20 p-4 rounded-none flex items-center gap-3 bg-black">
          <div className="w-10 h-10 bg-white flex items-center justify-center border border-white/20 text-black">
            <span className="text-sm font-bold">HR</span>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Sarah Admin</p>
            <p className="text-xs text-slate-400">ผู้อำนวยการฝ่ายบุคคล</p>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
