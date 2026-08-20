"use client";

import { Card } from "@/components/ui/Card";
import { AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface RequestFormProps {
  isOverBudget: boolean;
}

export function RequestForm({ isOverBudget }: RequestFormProps) {
  return (
    <Card className={cn("transition-all duration-500", isOverBudget && "border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)] dark:shadow-[0_0_30px_rgba(239,68,68,0.1)]")}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">คำขอตำแหน่งงานใหม่</h2>
        {isOverBudget && (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-500 dark:text-red-400 rounded-full text-sm font-medium animate-pulse">
            <AlertCircle className="w-4 h-4" />
            กระทบงบประมาณสูง
          </div>
        )}
      </div>

      <form className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-500 dark:text-slate-400 font-medium">แผนก</label>
            <select className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all">
              <option>ปฏิบัติการบิน</option>
              <option>บริการภาคพื้น</option>
              <option>วิศวกรรม</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-500 dark:text-slate-400 font-medium">ประเภทคำขอ</label>
            <select className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all">
              <option>ขยายอัตรากำลัง</option>
              <option>ทดแทนพนักงานเดิม</option>
              <option>ตามแผนประจำปี</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-500 dark:text-slate-400 font-medium">ชื่อตำแหน่ง</label>
          <input 
            type="text" 
            placeholder="เช่น นักบินผู้ช่วยอาวุโส"
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-500 dark:text-slate-400 font-medium">เหตุผลความจำเป็น</label>
          <textarea 
            rows={4}
            placeholder="ระบุเหตุผล..."
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none"
          />
        </div>

        <div className="pt-4 flex items-center gap-4">
          <button type="button" className="flex-1 bg-[#0F172A] dark:bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors shadow-sm">
            ส่งคำขอ
          </button>
          <button type="button" className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 flex items-center gap-2 shadow-sm">
            <FileText className="w-5 h-5" />
            แนบเอกสาร JD
          </button>
        </div>
      </form>
    </Card>
  );
}
