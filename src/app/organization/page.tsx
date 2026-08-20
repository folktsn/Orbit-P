"use client";

import { motion } from "framer-motion";
import { Search, X, Minus, Plus, Send, Download, Printer } from "lucide-react";
import { OrgChart } from "./components/OrgChart";
import { useState } from "react";

export default function OrganizationPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-white dark:bg-[#0A0A0A]">
      <OrgChart />
    </div>
  );
}
