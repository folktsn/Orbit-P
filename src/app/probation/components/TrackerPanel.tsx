"use client";

import { Card } from "@/components/ui/Card";
import { Send, Activity, CheckCircle } from "lucide-react";

export function TrackerPanel() {
  return (
    <div className="space-y-6">
      <Card className="border-t-4 border-t-purple-500 border-x-slate-100 dark:border-x-slate-800 border-b-slate-100 dark:border-b-slate-800">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full flex items-center justify-center text-xl font-bold">
            J
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">Jason Lee</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">ปฏิบัติการภาคพื้น</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center p-3 border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              <span className="font-medium text-slate-700 dark:text-slate-300">การประเมิน 30 วัน</span>
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-100 dark:bg-emerald-500/20 px-2 py-1 rounded-md">เสร็จสิ้น</span>
          </div>
          
          <div className="flex justify-between items-center p-3 border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              <span className="font-medium text-slate-700 dark:text-slate-300">การประเมิน 60 วัน</span>
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-100 dark:bg-emerald-500/20 px-2 py-1 rounded-md">เสร็จสิ้น</span>
          </div>

          <div className="flex justify-between items-center p-3 border border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/10 rounded-xl">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-purple-500 dark:text-purple-400 animate-pulse" />
              <span className="font-medium text-purple-900 dark:text-purple-100">การประเมิน 90 วัน</span>
            </div>
            <span className="text-xs text-purple-700 dark:text-purple-400 font-semibold bg-purple-100 dark:bg-purple-500/20 px-2 py-1 rounded-md">ครบกำหนดวันนี้</span>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <button className="w-full flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
            <Send className="w-4 h-4" /> ส่งแบบสอบถามพนักงาน
          </button>
        </div>
      </Card>
    </div>
  );
}
