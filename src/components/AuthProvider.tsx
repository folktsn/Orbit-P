"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export interface UserProfile {
  username: string;
  role: "admin" | "recruiter" | "hr";
  displayName: string;
  provider?: "credentials" | "line";
  lineAvatarUrl?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, role: "admin" | "recruiter" | "hr") => Promise<boolean>;
  loginWithLine: (
    role: "admin" | "recruiter" | "hr",
    lineNickname: string,
    lineAvatar: string,
    lineUserId?: string
  ) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if user session exists in sessionStorage
    const savedSession = sessionStorage.getItem("orbithire_session");
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession);
        setUser(sessionData);
      } catch (e) {
        console.error("Failed to parse auth session", e);
        sessionStorage.removeItem("orbithire_session");
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, role: "admin" | "recruiter" | "hr"): Promise<boolean> => {
    setLoading(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const displayNameMap = {
      admin: "Administrator",
      recruiter: "Senior Recruiter",
      hr: "HR Manager",
    };

    const newSession: UserProfile = {
      username,
      role,
      displayName: displayNameMap[role] || "User",
      provider: "credentials",
    };

    sessionStorage.setItem("orbithire_session", JSON.stringify(newSession));
    setUser(newSession);
    setLoading(false);
    router.replace("/");
    return true;
  };

  const loginWithLine = async (
    role: "admin" | "recruiter" | "hr",
    lineNickname: string,
    lineAvatar: string,
    lineUserId?: string
  ): Promise<boolean> => {
    setLoading(true);
    
    try {
      // Query the database lookup to find the linked employee profile in SQLite or DynamoDB
      const url = lineUserId
        ? `/api/auth/line/lookup?lineUserId=${encodeURIComponent(lineUserId)}`
        : `/api/auth/line/lookup?lineNickname=${encodeURIComponent(lineNickname)}`;
        
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success && result.data) {
        // Log in using the resolved employee profile from the database connection!
        const resolvedSession: UserProfile = result.data;
        sessionStorage.setItem("orbithire_session", JSON.stringify(resolvedSession));
        setUser(resolvedSession);
      } else {
        // LINE sessions must be backed by a verified employee profile.
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
    sessionStorage.removeItem("orbithire_session");
    setUser(null);
    router.replace("/login");
  };

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
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, loginWithLine, logout }}>
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
