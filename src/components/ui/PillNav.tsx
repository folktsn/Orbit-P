"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/AuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import "./PillNav.css";
import MetallicPaint from "@/components/ui/MetallicPaint";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/" },
  { name: "Organization", href: "/organization" },
  { name: "Manpower", href: "/manpower" },
  { name: "Employees", href: "/employees" },
  { name: "Quality", href: "/data-quality" },
  { name: "Recruitment", href: "/ats" },
  { name: "Probation", href: "/probation" },
];

function PillItem({ item, isActive }: { item: { name: string; href: string }; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={`nav-item pill ${isActive ? "is-active" : ""}`}
    >
      <span className="label-stack">
        <span className="pill-label">{item.name}</span>
      </span>
    </Link>
  );
}

export function PillNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    const activeItem = nav?.querySelector<HTMLElement>(".is-active");

    if (!nav || !activeItem) return;

    const frame = requestAnimationFrame(() => {
      const targetLeft = activeItem.offsetLeft - (nav.clientWidth - activeItem.offsetWidth) / 2;
      nav.scrollTo({ left: Math.max(0, targetLeft), behavior: "auto" });
    });

    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <header className="pill-header">
      {/* Absolute Left Branding Logo & Name */}
      <div className="pill-brand">
        <div className="pill-brand-mark">
          <MetallicPaint
            imageSrc="/logo.png"
            seed={42}
            scale={4}
            patternSharpness={1.2}
            noiseScale={0.5}
            speed={0.3}
            liquid={0.6}
            mouseAnimation={false}
            brightness={2.0}
            contrast={0.8}
            refraction={0.012}
            blur={0.01}
            chromaticSpread={2.0}
            fresnel={1}
            angle={0}
            waveAmplitude={1}
            distortion={0.4}
            contour={0.2}
            lightColor="#ffffff"
            darkColor="#111111"
            tintColor="#2b82ff"
          />
        </div>
        <div className="hidden md:flex flex-col leading-none">
          <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
            HO-Recruitment
          </span>
          <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-0.5">
            Pattaya Aviation
          </span>
        </div>
      </div>

      <nav ref={navRef} className="pill-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => (
          <PillItem key={item.name} item={item} isActive={pathname === item.href} />
        ))}
      </nav>

      <div className="pill-actions">
        {mounted && (
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="pill-action-button w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-100 dark:border-slate-700 hover:scale-105 active:scale-95 duration-200 transition-all cursor-pointer"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5" />}
          </button>
        )}

        {mounted && user && (
          <div ref={dropdownRef} className="relative">
            {/* Clickable Profile Avatar (Shows ONLY the photo) */}
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="pill-action-button w-10 h-10 rounded-full border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300 shadow-sm relative overflow-visible focus:outline-none cursor-pointer flex items-center justify-center bg-white dark:bg-slate-800 hover:scale-105 active:scale-95 duration-200"
              title={`${user.displayName} (${user.role})`}
            >
              {user.lineAvatarUrl ? (
                <div className="w-full h-full rounded-full overflow-hidden relative">
                  <img
                    src={user.lineAvatarUrl}
                    alt={user.displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-full rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                  {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : "US"}
                </div>
              )}
              {/* Status indicator badge (LINE green badge) */}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#06C755] border-2 border-white dark:border-slate-900 rounded-full shadow-sm" title="Logged in via LINE" />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 mt-2.5 w-60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden p-4 space-y-3.5"
                >
                  {/* User Profile Summary Header */}
                  <div className="flex items-center gap-3">
                    {user.lineAvatarUrl ? (
                      <img
                        src={user.lineAvatarUrl}
                        alt={user.displayName}
                        className="w-11 h-11 rounded-full object-cover border border-[#06C755] shadow-sm"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-base shadow-sm">
                        {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : "US"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 leading-none">
                      <span className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 truncate">
                        {user.displayName}
                        {user.provider === "line" && (
                          <span className="text-[8px] bg-[#06C755] text-white px-1.5 py-0.5 rounded-full font-bold leading-none tracking-wide shrink-0">LINE</span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block mt-1.5">
                        {user.role}
                      </span>
                    </div>
                  </div>

                  <hr className="border-slate-100 dark:border-white/5" />

                  {/* Actions Area */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100/50 dark:border-rose-900/30 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer shadow-sm hover:shadow"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>ออกจากระบบ / Logout</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
}
