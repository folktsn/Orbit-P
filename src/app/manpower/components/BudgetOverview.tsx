"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface BudgetOverviewProps {
  budgetLimit: number;
  headcount: number;
  requestCount: number;
  isOverBudget: boolean;
}

export function BudgetOverview({
  budgetLimit,
  headcount,
  requestCount,
  isOverBudget,
}: BudgetOverviewProps) {
  return (
    <Card>
      <h3 className="font-semibold mb-4">ภาพรวมงบประมาณ</h3>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1 text-slate-500 dark:text-slate-400">
            <span>งบประมาณที่อนุมัติแล้ว</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{budgetLimit} อัตรา</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 w-full" />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1 text-slate-500 dark:text-slate-400">
            <span>ปัจจุบัน + ที่กำลังขอ</span>
            <span className={cn("font-medium", isOverBudget ? "text-red-500 dark:text-red-400" : "text-slate-900 dark:text-slate-100")}>
              {headcount + requestCount} อัตรา
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
            <div className="h-full bg-blue-500" style={{ width: `${(headcount / budgetLimit) * 100}%` }} />
            <div className={cn("h-full", isOverBudget ? "bg-red-500" : "bg-purple-500")} style={{ width: `${(requestCount / budgetLimit) * 100}%` }} />
          </div>
        </div>
      </div>
    </Card>
  );
}
