"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PenTool } from "lucide-react";

export function DigitalSignature() {
  const [signed, setSigned] = useState(false);

  return (
    <div
      className={cn(
        "glass p-6 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden",
        signed ? "border-green-500/50 bg-green-500/5" : "border-dashed border-slate-200 dark:border-slate-700"
      )}
    >
      {!signed ? (
        <div className="flex flex-col items-center justify-center py-6 text-slate-400">
          <PenTool className="w-8 h-8 mb-3 opacity-50" />
          <p className="font-medium">ต้องการลายเซ็นผู้บริหาร</p>
          <button
            onClick={() => setSigned(true)}
            className="mt-4 px-6 py-2 bg-[#0F172A] dark:bg-blue-600 text-white rounded-full font-semibold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors shadow-sm"
          >
            ลงนามเอกสาร
          </button>
        </div>
      ) : (
        <div className="py-4">
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold mb-2">ลงนามสำเร็จ</p>
          <div className="font-[signature] text-4xl text-slate-900 dark:text-slate-100 opacity-80">
            อนุมัติโดยผู้อำนวยการ
          </div>
          <p className="text-xs text-slate-500 mt-2">เวลา: {new Date().toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}
