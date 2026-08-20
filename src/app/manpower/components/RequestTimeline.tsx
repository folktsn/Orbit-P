"use client";

import { Card } from "@/components/ui/Card";
import { CheckCircle2, Clock } from "lucide-react";

export function RequestTimeline() {
  return (
    <Card>
      <h3 className="font-semibold mb-6">ลำดับเวลาของคำขอ</h3>
      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
        
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-500 shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between space-x-2 mb-1">
              <div className="font-bold text-slate-900 dark:text-slate-100">สร้างร่างคำขอ</div>
              <time className="text-xs font-medium text-slate-500 dark:text-slate-400">เมื่อวาน</time>
            </div>
            <div className="text-slate-500 dark:text-slate-400 text-sm">สร้างโดยผู้จัดการแผนก</div>
          </div>
        </div>

        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-500 shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-slate-800/50 border border-blue-100 dark:border-blue-500/20 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between space-x-2 mb-1">
              <div className="font-bold text-slate-900 dark:text-slate-100">รอผู้อำนวยการอนุมัติ</div>
              <time className="text-xs font-medium text-blue-500">ค้างอยู่ 2 วัน</time>
            </div>
            <div className="text-slate-500 dark:text-slate-400 text-sm">รอการเซ็นอนุมัติแบบดิจิทัล</div>
          </div>
        </div>

        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl opacity-70">
            <div className="font-bold text-slate-600 dark:text-slate-400 mb-1">การอนุมัติจากฝ่ายบุคคล</div>
            <div className="text-slate-500 dark:text-slate-500 text-sm">ตรวจสอบขั้นสุดท้าย</div>
          </div>
        </div>

      </div>
    </Card>
  );
}
