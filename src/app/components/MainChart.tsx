"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { name: "Jan", applications: 400 },
  { name: "Feb", applications: 300 },
  { name: "Mar", applications: 500 },
  { name: "Apr", applications: 280 },
  { name: "May", applications: 590 },
  { name: "Jun", applications: 800 },
];

export function MainChart() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === "dark";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5 }}
      className="min-w-0 lg:col-span-2"
    >
      <Card className="flex h-[340px] min-w-0 flex-col p-4 sm:h-[400px] sm:p-6">
        <h3 className="text-lg font-semibold mb-4">แนวโน้มการสรรหา</h3>
        <div className="h-full w-full min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={isDark ? 0.5 : 0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
              <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} />
              <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: isDark ? "#1e293b" : "#FFFFFF", 
                  borderColor: isDark ? "#334155" : "#e2e8f0", 
                  borderRadius: '12px', 
                  color: isDark ? '#f1f5f9' : '#0F172A' 
                }}
                itemStyle={{ color: "#8B5CF6" }}
              />
              <Area
                type="monotone"
                dataKey="applications"
                stroke="#8B5CF6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorApps)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </motion.div>
  );
}
