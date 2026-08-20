"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, User, Shield, ArrowRight, Eye, EyeOff, Sparkles, LogIn, AlertCircle, MessageCircle, X, Check, Copy, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import MetallicPaint from "@/components/ui/MetallicPaint";

declare global {
  interface Window {
    liff: any;
  }
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
  const [detectedProfile, setDetectedProfile] = useState<any>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [copied, setCopied] = useState(false);

  // LIFF initialization tracking
  const [liffInitialized, setLiffInitialized] = useState(false);
  const [liffError, setLiffError] = useState<string | null>(null);

  const demoRoles = [
    {
      role: "admin" as const,
      username: "admin",
      password: "password",
      label: "Administrator",
      desc: "Full ERP System Access",
      color: "from-violet-500 to-indigo-500 shadow-violet-500/25",
      bgHover: "hover:bg-violet-500/10 dark:hover:bg-violet-500/20",
      borderHover: "hover:border-violet-500",
      badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
    },
    {
      role: "recruiter" as const,
      username: "recruiter",
      password: "password",
      label: "Recruiter",
      desc: "ATS & Candidates Hub",
      color: "from-sky-500 to-blue-500 shadow-sky-500/25",
      bgHover: "hover:bg-sky-500/10 dark:hover:bg-sky-500/20",
      borderHover: "hover:border-sky-500",
      badgeColor: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
    },
    {
      role: "hr" as const,
      username: "hr",
      password: "password",
      label: "HR Manager",
      desc: "Probation & Manpower Requests",
      color: "from-emerald-500 to-teal-500 shadow-emerald-500/25",
      bgHover: "hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20",
      borderHover: "hover:border-emerald-500",
      badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    }
  ];

  // Dynamic LIFF script loading and initialization
  useEffect(() => {
    if (typeof window === "undefined") return;

    const scriptId = "line-liff-sdk";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initializeLiff = async () => {
      try {
        if (!window.liff) {
          throw new Error("LIFF SDK failed to load onto window context");
        }
        
        // Initialize official LINE LIFF SDK using Client ID and App ID
        await window.liff.init({ liffId: "2008863753-eyUoNYLk" });
        setLiffInitialized(true);
        console.log("LINE LIFF SDK Initialized Successfully!");

        // Auto-check if returning from successful redirect and already authenticated
        if (window.liff.isLoggedIn()) {
          setShowLineModal(true);
          setLineView("detecting");
          await handleLiffLoginSuccess();
        }
      } catch (err: any) {
        console.error("LIFF Initialization failed:", err);
        setLiffError(err.message || "Failed to initialize LINE LIFF");
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
  const handleLiffLoginSuccess = async () => {
    try {
      if (!window.liff) return;
      const profile = await window.liff.getProfile();
      console.log("LIFF Profile retrieved:", profile);
      
      const lineUserId = profile.userId;
      setCustomLineUserId(lineUserId);

      // Perform a real-time DynamoDB scan/lookup for this LINE User ID
      const response = await fetch(`/api/auth/line/lookup?lineUserId=${encodeURIComponent(lineUserId)}&lineNickname=${encodeURIComponent(profile.displayName || "")}&lineAvatarUrl=${encodeURIComponent(profile.pictureUrl || "")}`);
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
        setCustomLineError("ไม่พบพนักงานที่เชื่อมโยงกับ LINE User ID นี้ในระบบฐานข้อมูล");
      }
    } catch (e: any) {
      console.error("Failed to fetch LIFF profile details:", e);
      setLineView("prompt");
      setCustomLineError("เกิดข้อผิดพลาดในการดึงข้อมูลหรือค้นหาโปรไฟล์ของคุณจาก LINE");
    }
  };

  // Official LINE Login Auth Redirect Trigger
  const handleGetStartedWithLine = () => {
    setCustomLineError("");
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
    } catch (err: any) {
      console.error("LIFF login redirect action failed:", err);
      setLineView("prompt");
      setCustomLineError("ไม่สามารถเชื่อมต่อระบบลงทะเบียน LINE ได้: " + err.message);
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
      await loginWithLine(
        detectedProfile.role,
        detectedProfile.displayName,
        detectedProfile.lineAvatarUrl || "/folk_tsn_avatar.png",
        lineId
      );
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
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden bg-black transition-colors duration-500">
      {/* Background Blurs */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none bg-black">
        <motion.div 
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -20, 30, 0],
            scale: [1, 1.05, 0.95, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -left-20 w-[600px] h-[600px] rounded-full bg-emerald-955/20 dark:bg-emerald-950/20 blur-[130px]"
        />
        <motion.div 
          animate={{
            x: [0, -40, 30, 0],
            y: [0, 30, -40, 0],
            scale: [1, 0.95, 1.05, 1]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-40 -right-20 w-[600px] h-[600px] rounded-full bg-violet-955/20 dark:bg-violet-955/15 blur-[130px]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-black pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      </div>

      {/* Theme Action Button */}
      <div className="absolute top-6 right-6 z-50">
        <button 
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-10 h-10 bg-white/5 dark:bg-slate-900/60 backdrop-blur-md rounded-full shadow-sm flex items-center justify-center text-slate-300 hover:text-white border border-white/10 hover:scale-105 transition-all duration-300"
        >
          {theme === "dark" ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-350" />}
        </button>
      </div>

      <div className="w-full max-w-4xl flex flex-col items-center justify-center text-center space-y-10 z-10 px-4 py-12">
        {/* Header Capsule */}
        <div className="flex flex-col items-center justify-center space-y-2 w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, type: "spring" }}
            className="inline-flex items-center gap-2 p-1.5 pr-4 bg-white/[0.03] border border-white/[0.08] rounded-full backdrop-blur-md hover:border-white/15 transition-all duration-300 shadow-xl"
          >
            <span className="px-2.5 py-0.5 bg-[#06C755] text-white font-extrabold rounded-full text-[9px] tracking-widest uppercase">
              ONLINE
            </span>
            <span className="text-xs text-slate-300 font-medium">
              OrbitHire Pattaya Aviation LIFF Login
            </span>
          </motion.div>

          {/* Premium Logo Emblem */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.03, rotateY: 10, rotateX: -5 }}
            transition={{ type: "spring", stiffness: 120, damping: 15 }}
            style={{ perspective: 1000 }}
            className="w-96 h-56 flex items-center justify-center overflow-visible relative cursor-pointer"
          >
            <div className="w-full h-full filter drop-shadow-[0_15px_25px_rgba(59,130,246,0.25)]">
              <MetallicPaint
                imageSrc="/logo.png"
                seed={42}
                scale={5}
                patternSharpness={1.5}
                noiseScale={0.4}
                speed={0.4}
                liquid={0.65}
                mouseAnimation={true}
                brightness={2.2}
                contrast={0.85}
                refraction={0.015}
                blur={0.008}
                chromaticSpread={2.5}
                fresnel={1}
                angle={45}
                waveAmplitude={1}
                distortion={0.5}
                contour={0.15}
                lightColor="#ffffff"
                darkColor="#0b0f19"
                tintColor="#2b82ff"
              />
            </div>
          </motion.div>

          {/* Center Titles */}
          <div className="space-y-4 max-w-3xl pt-1">
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.15] select-none"
            >
              Connecting People <br className="hidden sm:inline" /> to Possibilities
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed"
            >
              ระบบประเมินผลการทดลองงานและสรรหากำลังพล บริษัท พัทยา เอวิเอชั่น จำกัด <br />
              เชื่อมต่อรวดเร็ว ปลอดภัย และโปร่งใส ผ่านแอปพลิเคชัน LINE ของคุณ
            </motion.p>
          </div>
        </div>

        {/* Buttons / Dynamic view toggles */}
        <div className="w-full flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {!showCredentialsForm ? (
              <motion.div
                key="action-buttons"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full"
              >
                {/* Official LINE Action Button */}
                <button
                  type="button"
                  onClick={handleGetStartedWithLine}
                  className="w-full sm:w-auto min-w-[240px] bg-[#06C755] hover:bg-[#05b34c] text-white font-extrabold px-8 py-3.5 rounded-full flex items-center justify-center gap-2.5 cursor-pointer transition-all duration-300 text-sm hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-emerald-500/10 border border-[#05b34c]/20"
                >
                  <svg className="w-5 h-5 fill-current flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 5.58 2 10c0 2.9 1.87 5.48 4.7 7.02l-.5 1.83a.5.5 0 0 0 .7.57l2.25-1.25c.92.21 1.88.33 2.85.33 5.52 0 10-3.58 10-8s-4.48-8-10-8zm-1.8 11.23h-.8c-.1 0-.2-.1-.2-.2v-4.1c0-.1.1-.2.2-.2h.8c.1 0 .2.1.2.2v4.1c0 .1-.1.2-.2.2zm2.93 0h-.8c-.1 0-.2-.1-.2-.2v-3l-1.3 1.9c0 .1-.1.1-.2.1h-.2c-.1 0-.2-.1-.2-.2v-2.9c0-.1.1-.2.2-.2h.8c.1 0 .2.1.2.2v1.8l1.3-1.8c0-.1.1-.2.2-.2h.4c.1 0 .2.1.2.2v4.1c-.01.1-.11.2-.23.2zm2.87-2.1h-1.2v.9h1.2c.1 0 .2.1.2.2v.6c0 .1-.1.2-.2.2h-2c-.1 0-.2-.1-.2-.2v-4.1c0-.1.1-.2.2-.2h2c.1 0 .2.1.2.2v.6c0 .1-.1.2-.2.2h-1.2v.8h1.2c.1 0 .2.1.2.2v.6c0 .1-.1.2-.2.2z"/>
                  </svg>
                  Get started with LINE
                </button>

                {/* Staff Credentials Option */}
                <button
                  type="button"
                  onClick={() => setShowCredentialsForm(true)}
                  className="w-full sm:w-auto min-w-[200px] bg-white/[0.03] hover:bg-white/[0.08] text-white border border-white/10 px-8 py-3.5 rounded-full flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 text-sm hover:border-white/20 hover:scale-[1.02] active:scale-[0.98] backdrop-blur-md"
                >
                  Staff Login
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="credentials-form-card"
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                className="relative w-full max-w-md bg-white/[0.01] border border-white/10 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-2xl text-left overflow-hidden mx-auto"
              >
                {/* Loader overlay */}
                <AnimatePresence>
                  {isSubmitting && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center"
                    >
                      <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 text-xs font-semibold tracking-wider text-slate-350"
                      >
                        กำลังเข้าสู่ระบบในสิทธิ์ {activeRoleIndex !== null ? demoRoles[activeRoleIndex].label : "ผู้ใช้งาน"}...
                      </motion.p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowCredentialsForm(false)}
                  className="absolute top-5 right-5 text-slate-500 hover:text-white hover:scale-105 transition-all p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <h3 className="text-md font-bold text-white mb-1 flex items-center gap-2">
                  <LogIn className="w-4.5 h-4.5 text-[#00C300]" /> เข้าสู่ระบบด้วยบัญชีองค์กร
                </h3>
                <p className="text-[11px] text-slate-400 mb-6">
                  กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเชื่อมต่อระบบ ERP
                </p>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-5 p-3 rounded-xl bg-red-950/20 border border-red-900/30 flex items-start gap-2.5 text-red-400 text-[11px]"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">
                      ชื่อผู้ใช้งาน / Username
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-white transition-colors">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="ป้อนชื่อผู้ใช้"
                        className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 hover:border-white/15 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">
                      รหัสผ่าน / Password
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-white transition-colors">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 hover:border-white/15 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-3 py-3 bg-white hover:bg-white/95 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer shadow-lg"
                  >
                    เข้าสู่ระบบ / Sign In <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>

                {/* Live Demo Quick Select Cards */}
                <div className="mt-8 pt-6 border-t border-white/5 space-y-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    บัญชีทดลองระดับองค์กร / Corporate Demo Login
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {demoRoles.map((roleObj, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleQuickFill(roleObj, idx)}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.08] ${roleObj.borderHover} ${roleObj.bgHover} text-left transition-all group cursor-pointer relative overflow-hidden`}
                      >
                        <div className="z-10">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide uppercase ${roleObj.badgeColor} mr-2`}>
                            {roleObj.label}
                          </span>
                          <span className="text-[10px] text-slate-400 group-hover:text-white font-semibold transition-colors mt-1.5 block">
                            {roleObj.desc}
                          </span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-white transition-colors z-10" />
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

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

                  {/* Toggle alternative custom text search input */}
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
