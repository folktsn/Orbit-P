"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/components/AuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, User, Shield, ArrowRight, Eye, EyeOff, Sparkles, LogIn, AlertCircle, MessageCircle, X, Check, Copy, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import "./login.css";

declare global {
  interface Window {
    liff?: {
      init(options: { liffId: string }): Promise<void>;
      isLoggedIn(): boolean;
      login(options: { redirectUri: string }): void;
      logout(): void;
      getAccessToken(): string | null;
      getProfile(): Promise<{
        userId: string;
        displayName?: string;
        pictureUrl?: string;
      }>;
    };
  }
}

type DetectedProfile = {
  username?: string;
  role?: string;
  displayName?: string;
  lineAvatarUrl?: string;
  staffId?: string;
  provider?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function LoginPage() {
  const { login, loginWithLine } = useAuth();
  const { theme, setTheme } = useTheme();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRoleIndex, setActiveRoleIndex] = useState<number | null>(null);
  
  // LINE LIFF Login States
  const [showLineModal, setShowLineModal] = useState(false);
  const [lineAuthSuccess, setLineAuthSuccess] = useState(false);
  const [lineView, setLineView] = useState<'detecting' | 'prompt' | 'verified'>('detecting'); 
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [customLineUserId, setCustomLineUserId] = useState("");
  const [isCustomLineSubmitting, setIsCustomLineSubmitting] = useState(false);
  const [customLineError, setCustomLineError] = useState("");
  const [detectedProfile, setDetectedProfile] = useState<DetectedProfile | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [copied, setCopied] = useState(false);

  // LIFF initialization tracking
  const [liffError, setLiffError] = useState<string | null>(null);
  const [isLocalDevelopment, setIsLocalDevelopment] = useState(false);

  const demoRoles = [
    {
      role: "admin" as const,
      username: "admin",
      password: "password",
      label: "Administrator",
      desc: "Full ERP System Access"
    },
    {
      role: "recruiter" as const,
      username: "recruiter",
      password: "password",
      label: "Recruiter",
      desc: "ATS & Candidates Hub"
    },
    {
      role: "hr" as const,
      username: "hr",
      password: "password",
      label: "HR Manager",
      desc: "Probation & Manpower Requests"
    }
  ];

  // Dynamic LIFF script loading and initialization
  useEffect(() => {
    if (typeof window === "undefined") return;

    // LINE only accepts redirect URIs registered in the channel settings.
    // Keep local development usable without attempting an invalid LIFF redirect.
    if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      const localStateTimer = window.setTimeout(() => setIsLocalDevelopment(true), 0);
      return () => window.clearTimeout(localStateTimer);
    }

    const scriptId = "line-liff-sdk";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initializeLiff = async () => {
      try {
        if (!window.liff) {
          throw new Error("LIFF SDK failed to load onto window context");
        }
        
        // Initialize official LINE LIFF SDK using Client ID and App ID
        await window.liff.init({ liffId: "2008863753-eyUoNYLk" });
        console.log("LINE LIFF SDK Initialized Successfully!");

        // Auto-check if returning from successful redirect and already authenticated
        if (window.liff.isLoggedIn()) {
          setShowLineModal(true);
          setLineView("detecting");
          await handleLiffLoginSuccess();
        }
      } catch (err: unknown) {
        console.error("LIFF Initialization failed:", err);
        setLiffError(getErrorMessage(err, "Failed to initialize LINE LIFF"));
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
      script.async = true;
      script.onload = () => {
        initializeLiff();
      };
      document.body.appendChild(script);
    } else if (window.liff) {
      initializeLiff();
    }
  }, []);

  // Retrieve details from real LINE session and perform DB validation
  async function handleLiffLoginSuccess() {
    try {
      if (!window.liff) return;
      const profile = await window.liff.getProfile();
      const accessToken = window.liff.getAccessToken();
      if (!accessToken) throw new Error("LINE did not return an access token");
      
      const lineUserId = profile.userId;
      setCustomLineUserId(lineUserId);

      const response = await fetch("/api/auth/line/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      const result = await response.json();
      
      if (result.success && result.data) {
        // Authenticated Employee found!
        setDetectedProfile({
          username: result.data.username,
          role: result.data.role,
          displayName: profile.displayName || result.data.displayName,
          lineAvatarUrl: profile.pictureUrl || result.data.lineAvatarUrl || "/folk_tsn_avatar.png",
          staffId: result.data.staffId,
          provider: "line"
        });
        setLineView("verified");
      } else {
        // LINE connected, but no matching employee profile in database
        setDetectedProfile({
          displayName: profile.displayName,
          lineAvatarUrl: profile.pictureUrl || "/folk_tsn_avatar.png",
          username: profile.userId
        });
        setLineView("prompt");
        setCustomLineError(result.error || "ไม่พบพนักงานที่เชื่อมโยงกับ LINE User ID นี้ในระบบฐานข้อมูล");
      }
    } catch (e: unknown) {
      console.error("Failed to fetch LIFF profile details:", e);
      setLineView("prompt");
      setCustomLineError("เกิดข้อผิดพลาดในการดึงข้อมูลหรือค้นหาโปรไฟล์ของคุณจาก LINE");
    }
  }

  // Official LINE Login Auth Redirect Trigger
  const handleGetStartedWithLine = () => {
    setCustomLineError("");

    if (isLocalDevelopment) {
      setShowCredentialsForm(true);
      setError("LINE Login ใช้ได้เฉพาะโดเมนที่ลงทะเบียนกับ LINE เท่านั้น — localhost ให้ใช้ Staff Login");
      return;
    }

    setShowLineModal(true);
    setLineView("detecting");

    if (!window.liff) {
      setLineView("prompt");
      setCustomLineError("ระบบระบบล็อกอิน LINE ยังไม่พร้อมใช้งานในขณะนี้ กรุณารออีกสักครู่...");
      return;
    }

    try {
      if (!window.liff.isLoggedIn()) {
        // Redirect directly to the official LINE Auth consent page
        window.liff.login({ redirectUri: window.location.origin + "/login" });
      } else {
        handleLiffLoginSuccess();
      }
    } catch (err: unknown) {
      console.error("LIFF login redirect action failed:", err);
      setLineView("prompt");
      setCustomLineError("ไม่สามารถเชื่อมต่อระบบลงทะเบียน LINE ได้: " + getErrorMessage(err, "Unknown error"));
    }
  };

  // Manual fallback query search in database (useful for developers/local testing)
  const handleCustomLineUserIdAuth = async () => {
    if (!customLineUserId.trim()) return;
    setIsCustomLineSubmitting(true);
    setCustomLineError("");
    
    try {
      const response = await fetch(`/api/auth/line/lookup?lineUserId=${encodeURIComponent(customLineUserId.trim())}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setDetectedProfile(result.data);
        setLineAuthSuccess(true);
        setTimeout(() => {
          setLineView('verified');
          setLineAuthSuccess(false);
          setIsCustomLineSubmitting(false);
        }, 1000);
      } else {
        setCustomLineError(result.error || "ไม่พบพนักงานที่เชื่อมโยงกับ LINE User ID นี้ในระบบ");
        setIsCustomLineSubmitting(false);
      }
    } catch (e) {
      console.error(e);
      setCustomLineError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ฐานข้อมูล");
      setIsCustomLineSubmitting(false);
    }
  };

  // Logout/Disconnect LINE LIFF Session
  const handleLiffLogout = () => {
    if (window.liff && window.liff.isLoggedIn()) {
      window.liff.logout();
      setDetectedProfile(null);
      setCustomLineUserId("");
      setCustomLineError("");
      setLineView("prompt");
      // Clean query string parameters from browser Address Bar
      window.location.href = window.location.origin + "/login";
    }
  };

  // Complete session authentication with verified employee details
  const handleVerifiedLineLogin = async () => {
    if (!detectedProfile) return;
    setLineAuthSuccess(true);
    
    const lineId = customLineUserId.trim() || detectedProfile.staffId || detectedProfile.username;
    if (lineId) {
      sessionStorage.setItem("last_line_user_id", lineId);
      localStorage.setItem("last_line_user_id", lineId);
    }

    setTimeout(async () => {
      setShowLineModal(false);
      await loginWithLine();
      setLineAuthSuccess(false);
      setDetectedProfile(null);
      setCustomLineUserId("");
    }, 1200);
  };

  // Copy LINE User ID Helper
  const copyToClipboard = () => {
    if (!customLineUserId) return;
    navigator.clipboard.writeText(customLineUserId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // traditional form authentication
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLocalDevelopment) {
      setError("Staff Login ใช้ได้เฉพาะ localhost เท่านั้น");
      return;
    }

    if (!username.trim() || !password.trim()) {
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const matchedRole = demoRoles.find(
      (r) => r.username.toLowerCase() === username.trim().toLowerCase() && r.password === password
    );

    if (matchedRole) {
      await login(matchedRole.username, matchedRole.role);
    } else {
      setIsSubmitting(false);
      setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (กรุณาใช้บัญชีทดลององค์กรด้านล่าง)");
    }
  };

  const handleQuickFill = (roleObj: typeof demoRoles[0], index: number) => {
    setActiveRoleIndex(index);
    setUsername(roleObj.username);
    setPassword(roleObj.password);
    setError(null);
    
    setTimeout(() => {
      setIsSubmitting(true);
      login(roleObj.username, roleObj.role).catch(() => {
        setIsSubmitting(false);
      });
    }, 550);
  };

  return (
    <div className="login-page">
      <main className="login-shell" aria-labelledby="login-title">
        <section className="login-content">
          <header className="login-header">
            <div className="login-brand" aria-label="HO-Recruitment, Pattaya Aviation">
              <span className="login-brand-mark">
                <Image src="/logo.png" width={48} height={48} alt="" />
              </span>
              <span className="login-brand-copy">
                <strong>HO-Recruitment</strong>
                <span>PATTAYA AVIATION</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="login-theme-button"
              aria-label={theme === "dark" ? "ใช้โหมดสว่าง" : "ใช้โหมดกลางคืน"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
          </header>

          <div className="login-hero">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="login-kicker"
            >
              <span aria-hidden="true" />
              SECURE PEOPLE WORKSPACE
            </motion.div>

            <motion.h1
              id="login-title"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
            >
              OrbitHire
            </motion.h1>
            <motion.p
              className="login-lead"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
            >
              ระบบบริหารบุคลากรของ Pattaya Aviation
            </motion.p>
            <motion.p
              id="login-hint"
              className="login-description"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.16 }}
            >
              เข้าสู่พื้นที่ทำงานสำหรับการสรรหา กำลังพล และการประเมินผล
            </motion.p>

            <div className="login-auth-area">
              <AnimatePresence mode="wait">
                {!showCredentialsForm ? (
                  <motion.div
                    key="line-login-actions"
                    className="login-actions"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, delay: 0.18 }}
                  >
                    <button
                      type="button"
                      onClick={handleGetStartedWithLine}
                      className="login-line-button"
                      aria-describedby="login-hint"
                    >
                      <span className="login-line-mark" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M12 2C6.48 2 2 5.58 2 10c0 2.9 1.87 5.48 4.7 7.02l-.5 1.83a.5.5 0 0 0 .7.57l2.25-1.25c.92.21 1.88.33 2.85.33 5.52 0 10-3.58 10-8s-4.48-8-10-8zm-1.8 11.23h-.8c-.1 0-.2-.1-.2-.2v-4.1c0-.1.1-.2.2-.2h.8c.1 0 .2.1.2.2v4.1c0 .1-.1.2-.2.2zm2.93 0h-.8c-.1 0-.2-.1-.2-.2v-3l-1.3 1.9c0 .1-.1.1-.2.1h-.2c-.1 0-.2-.1-.2-.2v-2.9c0-.1.1-.2.2-.2h.8c.1 0 .2.1.2.2v1.8l1.3-1.8c0-.1.1-.2.2-.2h.4c.1 0 .2.1.2.2v4.1c-.01.1-.11.2-.23.2zm2.87-2.1h-1.2v.9h1.2c.1 0 .2.1.2.2v.6c0 .1-.1.2-.2.2h-2c-.1 0-.2-.1-.2-.2v-4.1c0-.1.1-.2.2-.2h2c.1 0 .2.1.2.2v.6c0 .1-.1.2-.2.2h-1.2v.8h1.2c.1 0 .2.1.2.2v.6c0 .1-.1.2-.2.2z" />
                        </svg>
                      </span>
                      <span>เข้าสู่ระบบด้วย LINE</span>
                      <span className="login-button-arrow" aria-hidden="true">
                        <ArrowRight />
                      </span>
                    </button>

                    {isLocalDevelopment && (
                      <button
                        type="button"
                        onClick={() => setShowCredentialsForm(true)}
                        className="login-staff-button"
                      >
                        <LogIn aria-hidden="true" />
                        Staff Login
                      </button>
                    )}

                    {liffError && (
                      <p className="login-inline-error" role="alert">
                        <AlertCircle aria-hidden="true" />
                        ระบบ LINE ยังไม่พร้อม กรุณาลองใหม่อีกครั้ง
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="local-login-form"
                    className="login-local-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AnimatePresence>
                      {isSubmitting && (
                        <motion.div
                          className="login-form-loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <span aria-hidden="true" />
                          <p>
                            กำลังเข้าสู่ระบบในสิทธิ์ {activeRoleIndex !== null ? demoRoles[activeRoleIndex].label : "ผู้ใช้งาน"}...
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="button"
                      onClick={() => setShowCredentialsForm(false)}
                      className="login-form-close"
                      aria-label="ปิด Staff Login"
                      title="Close"
                    >
                      <X aria-hidden="true" />
                    </button>

                    <div className="login-form-heading">
                      <LogIn aria-hidden="true" />
                      <div>
                        <h2>Staff Login</h2>
                        <p>สำหรับทดสอบระบบภายในเครื่องเท่านั้น</p>
                      </div>
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          className="login-form-error"
                          role="alert"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                        >
                          <AlertCircle aria-hidden="true" />
                          <span>{error}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="login-form">
                      <label>
                        <span>ชื่อผู้ใช้งาน / Username</span>
                        <span className="login-input-wrap">
                          <User aria-hidden="true" />
                          <input
                            type="text"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            placeholder="ป้อนชื่อผู้ใช้"
                            autoComplete="username"
                          />
                        </span>
                      </label>

                      <label>
                        <span>รหัสผ่าน / Password</span>
                        <span className="login-input-wrap">
                          <Lock aria-hidden="true" />
                          <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                          >
                            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                          </button>
                        </span>
                      </label>

                      <button type="submit" disabled={isSubmitting} className="login-submit-button">
                        เข้าสู่ระบบ
                        <ArrowRight aria-hidden="true" />
                      </button>
                    </form>

                    <div className="login-demo-list">
                      <p>
                        <Sparkles aria-hidden="true" />
                        Corporate Demo
                      </p>
                      <div>
                        {demoRoles.map((roleObj, index) => (
                          <button
                            key={roleObj.role}
                            type="button"
                            onClick={() => handleQuickFill(roleObj, index)}
                          >
                            <span>
                              <strong>{roleObj.label}</strong>
                              <small>{roleObj.desc}</small>
                            </span>
                            <ArrowRight aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {!showCredentialsForm && (
            <div className="login-status-grid" aria-label="System status">
              <div>
                <MessageCircle aria-hidden="true" />
                <span>
                  <small>IDENTITY</small>
                  <strong>LINE verified</strong>
                </span>
              </div>
              <div>
                <Shield aria-hidden="true" />
                <span>
                  <small>ACCESS</small>
                  <strong>Role controlled</strong>
                </span>
              </div>
              <div>
                <span className="login-live-dot" aria-hidden="true" />
                <span>
                  <small>STATUS</small>
                  <strong>Production online</strong>
                </span>
              </div>
            </div>
          )}

          <footer className="login-footer">
            <span>© {new Date().getFullYear()} Pattaya Aviation</span>
            <span>Human Resources</span>
          </footer>
        </section>

        <aside className="login-visual" aria-hidden="true">
          <Image
            src="/login-glass-background.png"
            alt=""
            fill
            preload
            sizes="100vw"
            className="login-visual-image"
          />
          <div className="login-visual-caption">
            <span>PEOPLE OPERATIONS</span>
            <strong>Clarity in every connection.</strong>
          </div>
          <div className="login-visual-index">01</div>
        </aside>
      </main>

      {/* AUTHENTIC LINE LIFF INTERACTION MODAL */}
      <AnimatePresence>
        {showLineModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="relative w-full max-w-md bg-[#111111] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden text-center"
            >
              {/* SUCCESS OVERLAY */}
              <AnimatePresence>
                {lineAuthSuccess && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-[#00C300] flex flex-col items-center justify-center text-white"
                  >
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1, rotate: [0, 10, -10, 0] }}
                      className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-[#00C300] shadow-lg mb-6"
                    >
                      <Check className="w-10 h-10 stroke-[3px]" />
                    </motion.div>
                    <h3 className="text-2xl font-bold tracking-tight">ยืนยันตัวตนสำเร็จ!</h3>
                    <p className="text-sm mt-2 text-emerald-100 font-medium">
                      เชื่อมโยงโปรไฟล์องค์กรสำเร็จ กำลังนำเข้าสู่ระบบ...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Close Modal */}
              <button
                onClick={() => setShowLineModal(false)}
                className="absolute top-5 right-5 text-slate-500 hover:text-white hover:scale-105 transition-all p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* VIEW 1: DETECTING LIFF STATUS / API LOOKUP */}
              {lineView === 'detecting' && (
                <div className="py-12 flex flex-col items-center justify-center">
                  <div className="relative flex items-center justify-center mb-8">
                    <div className="w-20 h-20 border-4 border-[#00C300]/20 border-t-[#00C300] rounded-full animate-spin"></div>
                    <div className="absolute w-12 h-12 border-4 border-emerald-500/20 border-b-emerald-500 rounded-full animate-spin animate-duration-1000" style={{ animationDirection: 'reverse' }}></div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">กำลังเรียกข้อมูล LINE LIFF...</h3>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    กำลังดึงข้อมูลรายละเอียดและประวัติบัญชีผู้ใช้งานจาก LINE และสแกนตำแหน่งงานพนักงานในฐานข้อมูลหลัก
                  </p>
                </div>
              )}

              {/* VIEW 2: UNVERIFIED USER / MANUAL ID LOOKUP FALLBACK */}
              {lineView === 'prompt' && (
                <div className="py-2 text-left">
                  <div className="text-center mb-5 pb-3 border-b border-slate-800/80">
                    <h1 
                      className="text-4xl font-extrabold tracking-wider text-[#00C300] mb-2 select-none" 
                      style={{ fontFamily: 'system-ui, sans-serif' }}
                    >
                      LINE
                    </h1>
                    
                    {detectedProfile && (
                      <span className="text-[10px] font-extrabold text-rose-500 bg-rose-950/10 px-3 py-1 rounded-full border border-rose-900/30 tracking-wide uppercase inline-block mb-2">
                        เข้าสู่ระบบ LINE สำเร็จ แต่ยังไม่ได้ผูกสิทธิ์องค์กร
                      </span>
                    )}

                    {!detectedProfile && (
                      <span className="text-[10px] font-extrabold text-[#00C300] bg-emerald-950/20 px-3 py-1 rounded-full border border-emerald-900/30 tracking-wide uppercase inline-block mb-2">
                        LINE LIFF Hub (Pattaya Aviation)
                      </span>
                    )}
                  </div>

                  {/* If user logged in but NOT linked as employee, show their actual LINE profile info so they know LIFF worked! */}
                  {detectedProfile && (
                    <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 mb-4 flex items-center gap-4">
                      <img 
                        src={detectedProfile.lineAvatarUrl} 
                        alt={detectedProfile.displayName} 
                        className="w-14 h-14 rounded-full border border-slate-800 object-cover" 
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{detectedProfile.displayName}</h4>
                        <p className="text-[10px] text-slate-450 mt-0.5 truncate">บัญชี LINE ส่วนตัวของคุณเชื่อมต่อแล้ว</p>
                      </div>
                    </div>
                  )}

                  {customLineError && (
                    <div className="mb-5 p-3 rounded-xl bg-rose-950/25 border border-rose-900/30 flex items-start gap-2.5 text-rose-400 text-xs">
                      <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block">การยืนยันไม่ผ่าน:</span>
                        <span className="text-[11px] leading-relaxed block mt-0.5">{customLineError}</span>
                      </div>
                    </div>
                  )}

                  {/* Copy User ID section if unverified */}
                  {detectedProfile && customLineUserId && (
                    <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-4 mb-4 text-slate-300">
                      <label className="text-[9px] font-extrabold tracking-wider uppercase block text-slate-500 mb-1.5">
                        รหัส LINE User ID ของคุณสำหรับลงทะเบียน:
                      </label>
                      <div className="flex gap-2 items-center bg-black/40 border border-slate-850 rounded-xl px-3 py-2 text-xs">
                        <span className="font-mono text-emerald-450 truncate flex-1">{customLineUserId}</span>
                        <button
                          onClick={copyToClipboard}
                          className="p-1 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5"
                          title="Copy LINE User ID"
                        >
                          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[9.5px] text-slate-500 mt-2 leading-relaxed">
                        กรุณาส่ง User ID ด้านบนให้เจ้าหน้าที่ฝ่ายบุคคล (Admin) ทำการเปิดสิทธิ์และผูกเชื่อมโยงข้อมูลในตารางพนักงาน DynamoDB เพื่อเข้าใช้งานระบบได้ในครั้งถัดไป
                      </p>
                    </div>
                  )}

                  {/* Direct ID lookup is intentionally limited to local development. */}
                  {isLocalDevelopment && (
                  <div className="bg-slate-900/20 rounded-2xl border border-slate-850 p-4 mb-4">
                    <button
                      type="button"
                      onClick={() => setShowCustomInput(!showCustomInput)}
                      className="w-full flex items-center justify-between text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-colors focus:outline-none cursor-pointer"
                    >
                      <span>สแกนหรือค้นหาด้วย LINE User ID ในฐานข้อมูล</span>
                      <span className="text-[9px] text-slate-500">{showCustomInput ? "ซ่อน / Hide" : "แสดง / Show"}</span>
                    </button>
                    
                    {showCustomInput && (
                      <div className="space-y-2 mt-3 pt-3 border-t border-slate-800/40">
                        <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                          ป้อน LINE User ID เช่น <strong className="text-emerald-400 font-mono">U05f37b7ea3767138d0681671464ec354</strong> เพื่อทำการดึงข้อมูลพนักงานตัวจริงจากตาราง DynamoDB มาทำการยืนยันตัวตนเข้าระบบ:
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customLineUserId}
                            onChange={(e) => setCustomLineUserId(e.target.value)}
                            placeholder="เช่น U05f37b7ea3767138d0681671464ec354"
                            className="flex-1 bg-slate-950 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs placeholder:text-slate-800 focus:outline-none focus:border-[#00C300] transition-colors"
                          />
                          <button
                            type="button"
                            onClick={handleCustomLineUserIdAuth}
                            disabled={!customLineUserId.trim() || isCustomLineSubmitting}
                            className="px-4 py-2 bg-[#00C300] hover:bg-[#00B300] disabled:bg-slate-850 disabled:text-slate-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer active:scale-95 shrink-0 flex items-center justify-center min-w-[70px]"
                          >
                            {isCustomLineSubmitting ? "ตรวจสอบ..." : "ยืนยัน"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  )}

                  {/* Disconnect/Logout LIFF option if logged in */}
                  {detectedProfile && (
                    <div className="text-center mt-5">
                      <button
                        onClick={handleLiffLogout}
                        className="text-xs text-rose-500 hover:text-rose-400 font-semibold cursor-pointer transition-colors inline-flex items-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" /> ตัดการเชื่อมต่อ LINE / Logout LINE
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 3: VERIFIED REAL PROFILE CARD (100% NO MOCKS) */}
              {lineView === 'verified' && detectedProfile && (
                <div className="py-4 flex flex-col items-center justify-center">
                  <h1 
                    className="text-4xl font-extrabold tracking-wider text-[#00C300] mb-6 select-none" 
                    style={{ fontFamily: 'system-ui, sans-serif' }}
                  >
                    LINE
                  </h1>

                  {/* Emerald Glowing Border for Verified profile */}
                  <div className="relative mb-6">
                    <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-[#00C300] shadow-lg shadow-[#00C300]/25">
                      <img 
                        src={detectedProfile.lineAvatarUrl || "/folk_tsn_avatar.png"} 
                        alt={detectedProfile.displayName} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="absolute bottom-1 right-1 w-6 h-6 bg-[#00C300] border-2 border-slate-950 rounded-full flex items-center justify-center text-white shadow-md">
                      <Check className="w-3.5 h-3.5 stroke-[3px]" />
                    </span>
                  </div>

                  <span className="text-[10px] font-extrabold text-[#00C300] bg-emerald-950/20 px-3 py-1 rounded-full border border-emerald-900/30 tracking-wide uppercase mb-3">
                    ตรวจสอบพบพนักงานองค์กรจริงสำเร็จ
                  </span>
                  
                  <h3 className="text-lg font-bold text-white mb-1">{detectedProfile.displayName}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-8">
                    สิทธิ์ระดับ: <span className="text-emerald-450">{detectedProfile.role}</span> • Staff ID: <span className="text-white font-mono">{detectedProfile.staffId || "ACTIVE_STAFF"}</span>
                  </p>

                  {/* Primary login execution button */}
                  <button
                    onClick={handleVerifiedLineLogin}
                    className="w-full py-4 bg-[#00C300] hover:bg-[#00B300] text-white font-bold text-md rounded-xl active:scale-[0.98] hover:scale-[1.01] transition-all cursor-pointer shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-1.5"
                  >
                    เข้าสู่ระบบ / Sign In <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Toggle button to switch/logout account */}
                  <button
                    onClick={handleLiffLogout}
                    className="mt-6 text-xs text-slate-500 hover:text-white font-semibold cursor-pointer transition-colors inline-flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" /> เข้าสู่ระบบด้วย LINE บัญชีอื่น
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
