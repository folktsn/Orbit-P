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
    <div className="p-8 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Control Tower</h1>
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
