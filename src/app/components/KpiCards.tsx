"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Users, Briefcase, Clock, AlertTriangle } from "lucide-react";

export function KpiCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="flex items-center gap-4 border-none shadow-sm">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl">
            <Briefcase className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">อัตราว่าง</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">124</h3>
          </div>
        </Card>
      </motion.div>
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="flex items-center gap-4 border-none shadow-sm">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
            <Users className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">จ้างงานเดือนนี้</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">45</h3>
          </div>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="flex items-center gap-4 border-none shadow-sm">
          <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-2xl">
            <Clock className="w-6 h-6 text-purple-500 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">เวลาเฉลี่ยในการสรรหา</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">18 วัน</h3>
          </div>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="flex items-center gap-4 border-none shadow-sm">
          <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-2xl">
            <AlertTriangle className="w-6 h-6 text-rose-500 dark:text-rose-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">ความเสี่ยงผิด SLA</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">3</h3>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
