"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasPermission, type PermissionKey, type PermissionSet } from "@/lib/permissions";

export interface UserProfile {
  username: string;
  role: "admin" | "recruiter" | "hr" | "employee";
  displayName: string;
  provider?: "credentials" | "line";
  lineAvatarUrl?: string;
  staffId?: string;
  permissions: PermissionSet;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, role: "admin" | "recruiter" | "hr") => Promise<boolean>;
  loginWithLine: () => Promise<boolean>;
  can: (permission: PermissionKey) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const result = await response.json();
        return result.user as UserProfile | undefined;
      })
      .then((sessionUser) => {
        if (cancelled) return;
        if (sessionUser) {
          sessionStorage.setItem("orbithire_session", JSON.stringify(sessionUser));
          setUser(sessionUser);
        } else {
          sessionStorage.removeItem("orbithire_session");
          setUser(null);
        }
      })
      .catch((error) => {
        console.error("Failed to restore auth session", error);
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (username: string, role: "admin" | "recruiter" | "hr"): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, role }),
      });
      if (!response.ok) return false;
      const result = await response.json();
      const newSession = result.user as UserProfile;
      sessionStorage.setItem("orbithire_session", JSON.stringify(newSession));
      setUser(newSession);
      router.replace("/");
      return true;
    } finally {
      setLoading(false);
    }
  };

  const loginWithLine = async (): Promise<boolean> => {
    setLoading(true);
    
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const result = await response.json();
      
      if (response.ok && result.authenticated && result.user) {
        const resolvedSession: UserProfile = result.user;
        sessionStorage.setItem("orbithire_session", JSON.stringify(resolvedSession));
        setUser(resolvedSession);
      } else {
        setLoading(false);
        return false;
      }
    } catch (e) {
      console.error("LINE database lookup failed:", e);
      setLoading(false);
      return false;
    }
    
    setLoading(false);
    router.replace("/");
    return true;
  };

  const logout = () => {
    void fetch("/api/auth/session", { method: "DELETE" });
    sessionStorage.removeItem("orbithire_session");
    setUser(null);
    router.replace("/login");
  };

  const can = (permission: PermissionKey) => hasPermission(user?.permissions, permission);

  const isPublicRoute = pathname === "/login";

  useEffect(() => {
    if (loading) return;

    if (!user && !isPublicRoute) {
      router.replace("/login");
    } else if (user && isPublicRoute) {
      router.replace("/");
    }
  }, [user, loading, pathname, router, isPublicRoute]);

  // Prevent flashing of protected content while loading or redirecting
  if (loading) {
    return <LoadingScreen />;
  }

  if (!user && !isPublicRoute) {
    return <LoadingScreen />;
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, loginWithLine, can, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50 dark:bg-black transition-colors duration-300">
      <div className="relative flex items-center justify-center">
        {/* Sleek dual spinning rings */}
        <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></div>
        <div className="absolute w-10 h-10 border-4 border-sky-500/20 border-b-sky-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
      </div>
      <p className="mt-6 text-sm font-medium text-slate-500 dark:text-slate-400 tracking-wider uppercase animate-pulse">
        HO-Recruitment
      </p>
    </div>
  );
}
