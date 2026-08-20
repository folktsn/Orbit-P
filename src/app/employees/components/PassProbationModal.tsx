"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Calendar, User, FileText, CheckCircle2, AlertCircle, UploadCloud, Loader2, ThumbsUp, ThumbsDown, Clock, Info } from "lucide-react";
import { EmployeeData } from "./EmployeeProfileDrawer";

interface PassProbationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeData;
  onSave: (probationPassData: {
    probationPassOperatorId: string;
    probationPassOperatorName: string;
    probationPassOperatorPosition: string;
    probationPassDate: string;
    probationPassAttachmentName: string;
    probationPassAttachmentData: string;
    outcome: "pass" | "fail" | "extend";
    lastWorkingDate?: string;
    extensionDays?: number;
    newProbationEndDate?: string;
  }) => Promise<void>;
}

export function PassProbationModal({ isOpen, onClose, employee, onSave }: PassProbationModalProps) {
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [operatorId, setOperatorId] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [operatorPosition, setOperatorPosition] = useState("");
  const [operationDate, setOperationDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentData, setAttachmentData] = useState("");
  
  // Evaluation fields
  const [evaluationOutcome, setEvaluationOutcome] = useState<"pass" | "fail" | "extend">("pass");
  const [lastWorkingDate, setLastWorkingDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [extensionDays, setExtensionDays] = useState<number>(30);
  const [isCustomDays, setIsCustomDays] = useState(false);
  const [customDaysValue, setCustomDaysValue] = useState("");

  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all employees once when opened to search operators locally
  useEffect(() => {
    if (isOpen) {
      setIsSearching(true);
      fetch('/api/employees')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const mapped = data.map((item: any) => {
              const empId = item.emp_code || item.staff_id || item.employeeId || item.id || "N/A";
              
              let rawThTitle = item.title_th && item.title_th !== "undefined" && item.title_th !== "null" ? item.title_th.trim() : "";
              let rawEnTitle = item.title_en && item.title_en !== "undefined" && item.title_en !== "null" ? item.title_en.trim() : "";
              
              // Prioritize building the name from first_name_th and last_name_th
              let baseThName = "";
              const thFirst = item.first_name_th && item.first_name_th !== "undefined" && item.first_name_th !== "null" ? item.first_name_th.trim() : "";
              const thLast = item.last_name_th && item.last_name_th !== "undefined" && item.last_name_th !== "null" ? item.last_name_th.trim() : "";
              if (thFirst || thLast) {
                baseThName = `${thFirst} ${thLast}`.trim();
              }
              if (!baseThName && item.name_th && item.name_th !== "undefined" && item.name_th !== "null") {
                baseThName = item.name_th.trim();
              }
              if (!baseThName) {
                baseThName = item.name && item.name !== "undefined" && item.name !== "null" ? item.name : "Unknown";
              }

              // Prioritize building the name from first_name_en and last_name_en
              let baseEnName = "";
              const enFirst = item.first_name_en && item.first_name_en !== "undefined" && item.first_name_en !== "null" ? item.first_name_en.trim() : "";
              const enLast = item.last_name_en && item.last_name_en !== "undefined" && item.last_name_en !== "null" ? item.last_name_en.trim() : "";
              if (enFirst || enLast) {
                baseEnName = `${enFirst} ${enLast}`.trim();
              }
              if (!baseEnName && item.name_en && item.name_en !== "undefined" && item.name_en !== "null") {
                baseEnName = item.name_en.trim();
              }
              if (!baseEnName) {
                baseEnName = "-";
              }

              let cleanThName = baseThName.replace(/^[\s\.\-]+/, "").replace(/^(?:(?:นาย|นางสาว|นาง)[\s\.\-]*)+/, "").trim();
              let cleanEnName = baseEnName.replace(/^[\s\.\-]+/, "").replace(/^(?:(?:Mr\.|Mr|Mrs\.|Mrs|Miss|Ms\.|Ms)[\s\.\-]*)+/i, "").trim();

              const displayName = rawThTitle && cleanThName !== "-" ? `${rawThTitle}${cleanThName}` : cleanThName;
              const displayNameEn = rawEnTitle && cleanEnName !== "-" ? `${rawEnTitle} ${cleanEnName}` : cleanEnName;

              const position = item.position_en || item.position || item.title || "-";

              return {
                id: empId,
                name: displayName,
                nameEn: displayNameEn,
                position: position
              };
            });
            setAllEmployees(mapped);
          }
        })
        .catch(err => {
          console.error("Error fetching employee directory for operators:", err);
          setErrorMessage("ไม่สามารถโหลดรายชื่อพนักงานเพื่อใช้ตรวจสอบสิทธิ์ผู้ดำเนินการได้");
        })
        .finally(() => {
          setIsSearching(false);
        });
    } else {
      // Reset state when closed
      setOperatorId("");
      setOperatorName("");
      setOperatorPosition("");
      setAttachmentName("");
      setAttachmentData("");
      setEvaluationOutcome("pass");
      setErrorMessage("");
      setIsCustomDays(false);
      setCustomDaysValue("");
    }
  }, [isOpen]);

  // Lookup operator whenever ID changes
  useEffect(() => {
    if (!operatorId.trim()) {
      setOperatorName("");
      setOperatorPosition("");
      return;
    }
    
    const matched = allEmployees.find(emp => emp.id === operatorId.trim());
    if (matched) {
      const resolvedName = matched.nameEn && matched.nameEn !== "-" ? matched.nameEn : matched.name;
      setOperatorName(resolvedName);
      setOperatorPosition(matched.position);
    } else {
      setOperatorName("");
      setOperatorPosition("");
    }
  }, [operatorId, allEmployees]);

  // Dynamic Date Calculations for Extension
  const extensionDetails = useMemo(() => {
    if (evaluationOutcome !== "extend") return null;

    const days = isCustomDays ? Number(customDaysValue) || 0 : extensionDays;
    
    // Parse current probation end date
    let baseDate = new Date();
    if (employee.probationEnd && employee.probationEnd !== "-") {
      const p = employee.probationEnd.split("-");
      if (p.length === 3) {
        baseDate = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      }
    }

    // New probation end date = current probation end + extension days
    const newEndDate = new Date(baseDate.getTime());
    newEndDate.setDate(newEndDate.getDate() + days);

    const yyyy = newEndDate.getFullYear();
    const mm = String(newEndDate.getMonth() + 1).padStart(2, '0');
    const dd = String(newEndDate.getDate()).padStart(2, '0');
    const newEndDateStr = `${yyyy}-${mm}-${dd}`;

    // Remaining days from today until new probation end date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const calculationEndDate = new Date(yyyy, newEndDate.getMonth(), newEndDate.getDate());
    calculationEndDate.setHours(0, 0, 0, 0);
    
    const diffTime = calculationEndDate.getTime() - today.getTime();
    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      newProbationEndDate: newEndDateStr,
      remainingDays: remainingDays > 0 ? remainingDays : 0,
      days,
    };
  }, [evaluationOutcome, employee.probationEnd, extensionDays, isCustomDays, customDaysValue]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentName(file.name);
      setAttachmentData(reader.result as string);
    };
    reader.onerror = () => {
      alert("Error reading file.");
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentName(file.name);
      setAttachmentData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveClick = async () => {
    if (!isValidForm) return;
    
    setIsSaving(true);
    try {
      const activeDays = isCustomDays ? Number(customDaysValue) || 0 : extensionDays;

      await onSave({
        probationPassOperatorId: operatorId.trim(),
        probationPassOperatorName: operatorName,
        probationPassOperatorPosition: operatorPosition,
        probationPassDate: operationDate,
        probationPassAttachmentName: attachmentName,
        probationPassAttachmentData: attachmentData,
        outcome: evaluationOutcome,
        lastWorkingDate: evaluationOutcome === "fail" ? lastWorkingDate : undefined,
        extensionDays: evaluationOutcome === "extend" ? activeDays : undefined,
        newProbationEndDate: evaluationOutcome === "extend" ? extensionDetails?.newProbationEndDate : undefined,
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      alert("Error saving probation details: " + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const isValidForm = useMemo(() => {
    const baseValid = 
      operatorId.trim() !== "" &&
      operatorName !== "" &&
      operatorPosition !== "" &&
      operationDate !== "" &&
      attachmentName !== "" &&
      attachmentData !== "";

    if (!baseValid) return false;

    if (evaluationOutcome === "fail") {
      return lastWorkingDate !== "";
    }

    if (evaluationOutcome === "extend") {
      const days = isCustomDays ? Number(customDaysValue) : extensionDays;
      return days !== undefined && !isNaN(days) && days > 0;
    }

    return true;
  }, [operatorId, operatorName, operatorPosition, operationDate, attachmentName, attachmentData, evaluationOutcome, lastWorkingDate, extensionDays, isCustomDays, customDaysValue]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />
          
          {/* Card container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl z-[110] overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header with soft gradient */}
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">Probation Evaluation Confirmation</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  แบบฟอร์มบันทึกผลการประเมินทดลองงานสำหรับคุณ {employee.nameEn !== "-" ? employee.nameEn : employee.name}
                </p>
              </div>
              <button 
                onClick={onClose} 
                disabled={isSaving}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors text-slate-400 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Form body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {errorMessage && (
                <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. Probation Outcome Selections */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                  1. ผลการประเมินทดลองงาน <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Pass Card */}
                  <button
                    type="button"
                    onClick={() => setEvaluationOutcome("pass")}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all duration-300 ${
                      evaluationOutcome === "pass"
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm"
                        : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                    }`}
                  >
                    <ThumbsUp className={`w-5 h-5 mb-1.5 ${evaluationOutcome === "pass" ? "scale-110" : ""}`} />
                    <span className="text-xs font-bold">ผ่านทดลองงาน</span>
                  </button>

                  {/* Fail Card */}
                  <button
                    type="button"
                    onClick={() => setEvaluationOutcome("fail")}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all duration-300 ${
                      evaluationOutcome === "fail"
                        ? "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 shadow-sm"
                        : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                    }`}
                  >
                    <ThumbsDown className={`w-5 h-5 mb-1.5 ${evaluationOutcome === "fail" ? "scale-110" : ""}`} />
                    <span className="text-xs font-bold">ไม่ผ่านทดลองงาน</span>
                  </button>

                  {/* Extend Card */}
                  <button
                    type="button"
                    onClick={() => setEvaluationOutcome("extend")}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all duration-300 ${
                      evaluationOutcome === "extend"
                        ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-sm"
                        : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                    }`}
                  >
                    <Clock className={`w-5 h-5 mb-1.5 ${evaluationOutcome === "extend" ? "scale-110" : ""}`} />
                    <span className="text-xs font-bold">ขยายทดลองงาน</span>
                  </button>
                </div>
              </div>

              {/* Conditional Inputs */}
              <AnimatePresence mode="wait">
                {evaluationOutcome === "fail" && (
                  <motion.div
                    key="fail-fields"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden space-y-3"
                  >
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                        วันที่ปฏิบัติงานเป็นวันสุดท้าย (Last Working Date) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={lastWorkingDate}
                          onChange={(e) => setLastWorkingDate(e.target.value)}
                          disabled={isSaving}
                          className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        * พนักงานจะคงอยู่เป็น Active จนกระทั่งถึงวันที่ระบุนี้ จึงจะเปลี่ยนเป็น Failed Probation
                      </p>
                    </div>
                  </motion.div>
                )}

                {evaluationOutcome === "extend" && (
                  <motion.div
                    key="extend-fields"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                          จำนวนวันที่ขยายเวลา <span className="text-red-500">*</span>
                        </label>
                        {!isCustomDays ? (
                          <select
                            value={extensionDays}
                            onChange={(e) => {
                              if (e.target.value === "custom") {
                                setIsCustomDays(true);
                              } else {
                                setExtensionDays(Number(e.target.value));
                              }
                            }}
                            disabled={isSaving}
                            className="w-full bg-white dark:bg-[#161616] border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-[#1f1f1f] dark:[&>option]:text-slate-100"
                          >
                            <option className="bg-white text-slate-900 dark:bg-[#1f1f1f] dark:text-slate-100" value={30}>30 วัน</option>
                            <option className="bg-white text-slate-900 dark:bg-[#1f1f1f] dark:text-slate-100" value={60}>60 วัน</option>
                            <option className="bg-white text-slate-900 dark:bg-[#1f1f1f] dark:text-slate-100" value={90}>90 วัน</option>
                            <option className="bg-white text-slate-900 dark:bg-[#1f1f1f] dark:text-slate-100" value={120}>120 วัน</option>
                            <option className="bg-white text-slate-900 dark:bg-[#1f1f1f] dark:text-slate-100" value="custom">กำหนดเอง...</option>
                          </select>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="เช่น 45"
                              value={customDaysValue}
                              onChange={(e) => setCustomDaysValue(e.target.value)}
                              disabled={isSaving}
                              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomDays(false);
                                setExtensionDays(30);
                              }}
                              className="text-xs text-blue-500 dark:text-blue-400 hover:underline px-1"
                            >
                              เลือกช่วงวัน
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                          วันสิ้นสุดทดลองงานเดิม
                        </label>
                        <div className="bg-slate-100 dark:bg-white/5 rounded-xl px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400 font-medium border border-slate-200/50 dark:border-white/5">
                          {employee.probationEnd || "-"}
                        </div>
                      </div>
                    </div>

                    {/* Calculated Extension Results Display Card */}
                    {extensionDetails && (
                      <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                          <Info className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-bold uppercase tracking-wider">
                            ผลการคำนวณวันทดลองงานใหม่
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-1">
                          <div>
                            <span className="text-[10px] text-slate-400 font-medium block">
                              วันสิ้นสุดทดลองงานใหม่:
                            </span>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              {extensionDetails.newProbationEndDate}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-medium block">
                              จำนวนวันคงเหลือประเมินอีกครั้ง:
                            </span>
                            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                              {extensionDetails.remainingDays} วัน
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <hr className="border-slate-100 dark:border-white/5 my-2" />

              {/* 2. Operator Employee ID */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  2. รหัสพนักงาน ผู้ดำเนินการ <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    disabled={isSearching || isSaving}
                    placeholder="ป้อนรหัสพนักงานผู้มีอำนาจดำเนินการ..."
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 font-medium"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  {isSearching && (
                    <Loader2 className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" />
                  )}
                  {!isSearching && operatorName && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3.5 top-1/2 -translate-y-1/2 animate-pulse" />
                  )}
                </div>
              </div>

              {/* 3 & 4. Operator Name & Position (Resolved state) */}
              <AnimatePresence>
                {operatorId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden space-y-3"
                  >
                    {operatorName ? (
                      <div className="grid grid-cols-2 gap-3 p-4 bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 rounded-2xl">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                            3. ชื่อ-นามสกุลผู้ดำเนินการ
                          </span>
                          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                            {operatorName}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                            4. ตำแหน่งผู้ดำเนินการ
                          </span>
                          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                            {operatorPosition}
                          </span>
                        </div>
                      </div>
                    ) : (
                      !isSearching && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 text-amber-700 dark:text-amber-400 rounded-2xl text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>ไม่พบรหัสพนักงานนี้ในระบบหลัก กรุณาระบุรหัสพนักงานที่ถูกต้อง</span>
                        </div>
                      )
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 5. Operation Date */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  5. วันที่ดำเนินการอนุมัติประเมินผล <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={operationDate}
                    onChange={(e) => setOperationDate(e.target.value)}
                    disabled={isSaving}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* 6. Upload Attachment */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  6. แนบเอกสารผลการประเมินทดลองงาน <span className="text-red-500">*</span>
                </label>
                
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                    attachmentName
                      ? "bg-blue-50/20 dark:bg-blue-500/5 border-blue-300 dark:border-blue-500/20"
                      : "bg-slate-50 hover:bg-slate-100/50 dark:bg-black/20 dark:hover:bg-white/5 border-slate-200 dark:border-white/10"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  />
                  
                  {attachmentName ? (
                    <>
                      <div className="p-3 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl">
                        <FileText className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 max-w-[250px] truncate">
                          {attachmentName}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          คลิกหรือลากไฟล์ใหม่มาวางหากต้องการเปลี่ยนไฟล์
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3 bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 rounded-2xl">
                        <UploadCloud className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          อัปโหลดไฟล์ประเมินทดลองงาน (PDF, Image, Word)
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์จากคอมพิวเตอร์
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer buttons */}
            <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/20 flex justify-end gap-3">
              <button 
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveClick}
                disabled={isSaving || !isValidForm}
                className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ${
                  evaluationOutcome === "pass"
                    ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:via-teal-600 hover:to-emerald-700"
                    : evaluationOutcome === "fail"
                    ? "bg-gradient-to-r from-rose-500 via-red-500 to-rose-600 hover:from-rose-600 hover:via-red-600 hover:to-rose-700"
                    : "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700"
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึกข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>
                      {evaluationOutcome === "pass" 
                        ? "บันทึกผ่านทดลองงาน" 
                        : evaluationOutcome === "fail"
                        ? "บันทึกไม่ผ่านทดลองงาน"
                        : "บันทึกขยายทดลองงาน"
                      }
                    </span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
