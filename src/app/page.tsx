"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { KpiCards } from "./components/KpiCards";
import { MainChart } from "./components/MainChart";
import { SidePanel } from "./components/SidePanel";

export default function Dashboard() {
  // Simulate Background Service (Cron Job)
  useEffect(() => {
    fetch('/api/cron/process-adjustments')
      .then(res => res.json())
      .then(data => {
        if (data.success) console.log("Background Service:", data.message);
      })
      .catch(err => console.error("Background Service Error:", err));
  }, []);

  return (
    <div className="w-full min-w-0 space-y-5 p-4 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Control Tower</h1>
          <p className="text-slate-400 mt-1">
            ภาพรวมการสรรหาและกำลังคนแบบเรียลไทม์
          </p>
        </div>
      </motion.div>

      <KpiCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MainChart />
        <SidePanel />
      </div>
    </div>
  );
}
