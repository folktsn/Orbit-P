"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const pieData = [
  { name: "Filled", value: 400 },
  { name: "Open", value: 120 },
];

export function SidePanel() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === "dark";
  const COLORS = ["#8B5CF6", isDark ? "#334155" : "#F1F5F9"];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="h-[188px] flex flex-col items-center justify-center relative">
          <h3 className="text-sm font-semibold absolute top-4 left-6">สัดส่วนการเติมเต็มกำลังคน</h3>
          <ResponsiveContainer width="100%" height="100%" className="mt-4">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                startAngle={180}
                endAngle={0}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: isDark ? "#1e293b" : "#FFFFFF", borderColor: isDark ? "#334155" : "#e2e8f0", borderRadius: "12px", color: isDark ? "#f1f5f9" : "#0F172A" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute bottom-6 text-center">
            <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">76%</p>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="h-[188px] overflow-hidden">
          <h3 className="text-sm font-semibold mb-4">ความเคลื่อนไหวล่าสุด</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">ผู้สมัครเปลี่ยนสถานะเป็น <span className="text-slate-900 dark:text-slate-100 font-medium">จ้างงาน</span></p>
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">2 นาที</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">คำขออัตรากำลังใหม่ <span className="text-slate-900 dark:text-slate-100 font-medium">นักบิน (A320)</span></p>
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">15 นาที</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">นัดหมายสัมภาษณ์เรียบร้อย</p>
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">1 ชม.</span>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
