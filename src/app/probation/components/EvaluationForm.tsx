"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { UserCheck, FileWarning, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type EvaluationStep = 1 | 2 | 3;

interface EvaluationFormProps {
  step: EvaluationStep;
  setStep: (step: EvaluationStep | ((prev: EvaluationStep) => EvaluationStep)) => void;
  selectedOutcome: "Pass" | "Fail" | null;
  setSelectedOutcome: (outcome: "Pass" | "Fail" | null) => void;
  isProcessing: boolean;
  isCompleted: boolean;
  setIsCompleted: (completed: boolean) => void;
  handleNext: () => void;
  handleProcessOutcome: () => void;
}

export function EvaluationForm({
  step,
  setStep,
  selectedOutcome,
  setSelectedOutcome,
  isProcessing,
  isCompleted,
  setIsCompleted,
  handleNext,
  handleProcessOutcome,
}: EvaluationFormProps) {
  return (
    <div className="lg:col-span-2">
      <Card className="min-h-[500px] flex flex-col">
        {!isCompleted ? (
          <>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">การประเมินผลขั้นสุดท้าย (90 วัน)</h2>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={cn(
                      "w-8 h-2 rounded-full transition-colors duration-300",
                      s === step ? "bg-purple-500" : s < step ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="flex-1 relative">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 mb-4">เกณฑ์ชี้วัดผลงาน</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm text-slate-500 dark:text-slate-400 flex justify-between">
                            <span>คุณภาพงาน</span>
                            <span className="text-purple-600 dark:text-purple-400 font-medium">4/5</span>
                          </label>
                          <input type="range" min="1" max="5" defaultValue="4" className="w-full accent-purple-600" />
                        </div>
                        <div>
                          <label className="text-sm text-slate-500 dark:text-slate-400 flex justify-between">
                            <span>การปฏิบัติตามกฎความปลอดภัย</span>
                            <span className="text-purple-600 dark:text-purple-400 font-medium">5/5</span>
                          </label>
                          <input type="range" min="1" max="5" defaultValue="5" className="w-full accent-purple-600" />
                        </div>
                        <div>
                          <label className="text-sm text-slate-500 dark:text-slate-400 flex justify-between">
                            <span>การทำงานร่วมกับทีม</span>
                            <span className="text-purple-600 dark:text-purple-400 font-medium">3/5</span>
                          </label>
                          <input type="range" min="1" max="5" defaultValue="3" className="w-full accent-purple-600" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 mb-2">ความคิดเห็นจากผู้จัดการ</h3>
                    <textarea
                      rows={6}
                      placeholder="ให้ความเห็นเกี่ยวกับผลการทำงานของพนักงานในช่วง 90 วันที่ผ่านมา..."
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 mb-2">การตัดสินใจขั้นสุดท้าย</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setSelectedOutcome("Pass")}
                        className={cn(
                          "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all",
                          selectedOutcome === "Pass"
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                        )}
                      >
                        <UserCheck className="w-8 h-8" />
                        <span className="font-semibold text-lg">ผ่านการทดลองงาน</span>
                        <span className="text-xs opacity-70">อัปเดตฐานข้อมูลพนักงานอัตโนมัติ</span>
                      </button>
                      
                      <button
                        onClick={() => setSelectedOutcome("Fail")}
                        className={cn(
                          "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all",
                          selectedOutcome === "Fail"
                            ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                        )}
                      >
                        <FileWarning className="w-8 h-8" />
                        <span className="font-semibold text-lg">ไม่ผ่านการทดลองงาน</span>
                        <span className="text-xs opacity-70">สร้างเอกสารเลิกจ้างอัตโนมัติ</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4">
              {step > 1 && (
                <button
                  onClick={() => setStep((prev) => (prev - 1) as EvaluationStep)}
                  className="px-6 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  กลับ
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={handleNext}
                  className="px-6 py-2 bg-[#0F172A] dark:bg-blue-600 text-white rounded-xl font-semibold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  ถัดไป <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleProcessOutcome}
                  disabled={!selectedOutcome || isProcessing}
                  className="px-8 py-2 bg-[#0F172A] dark:bg-blue-600 text-white rounded-xl font-semibold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                >
                  {isProcessing ? (
                    <span className="animate-pulse">กำลังประมวลผล...</span>
                  ) : (
                    "ยืนยันการตัดสินใจ"
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center space-y-4"
          >
            {selectedOutcome === "Pass" ? (
              <>
                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">พนักงานผ่านการประเมิน</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                  ฐานข้อมูลพนักงานถูกอัปเดตเรียบร้อยแล้ว ยินดีต้อนรับสู่ทีม!
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                  <XCircle className="w-10 h-10 text-red-500 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">ไม่ผ่านการทดลองงาน</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                  เอกสารเลิกจ้างถูกสร้างและส่งให้ฝ่ายบุคคลพิจารณาเรียบร้อยแล้ว
                </p>
              </>
            )}
            <button
              onClick={() => {
                setIsCompleted(false);
                setStep(1);
                setSelectedOutcome(null);
              }}
              className="mt-6 px-6 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              ประเมินพนักงานคนต่อไป
            </button>
          </motion.div>
        )}
      </Card>
    </div>
  );
}
