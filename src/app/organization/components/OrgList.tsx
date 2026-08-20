"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronDown, Building2, Users, Layers, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgData {
  id: string;
  department_code: string;
  department_en: string;
  department_th: string;
  division_code: string;
  division_en: string;
  division_th: string;
  section_code: string;
  section_en: string;
  section_th: string;
  unit_code: string;
  unit_en: string;
  unit_th: string;
  position_en: string;
  position_th: string;
  station: string;
}

interface OrgListProps {
  searchQuery?: string;
}

// Helper to group data
const groupBy = (array: any[], key: string) => {
  return array.reduce((result, currentValue) => {
    const groupKey = currentValue[key] || "Unknown";
    (result[groupKey] = result[groupKey] || []).push(currentValue);
    return result;
  }, {});
};

export function OrgList({ searchQuery = "" }: OrgListProps) {
  const [orgData, setOrgData] = useState<OrgData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const [expandedDivs, setExpandedDivs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch("/api/organization", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch organization data");
        const data = await res.json();
        setOrgData(data);
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchOrg();
  }, []);

  const toggleDept = (dept: string) => {
    setExpandedDepts(prev => ({ ...prev, [dept]: !prev[dept] }));
  };

  const toggleDiv = (div: string) => {
    setExpandedDivs(prev => ({ ...prev, [div]: !prev[div] }));
  };

  // Filter Data
  const filteredData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return orgData;
    
    return orgData.filter(item => {
      return (
        (item.department_en && item.department_en.toLowerCase().includes(query)) ||
        (item.department_th && item.department_th.toLowerCase().includes(query)) ||
        (item.division_en && item.division_en.toLowerCase().includes(query)) ||
        (item.division_th && item.division_th.toLowerCase().includes(query)) ||
        (item.section_en && item.section_en.toLowerCase().includes(query)) ||
        (item.section_th && item.section_th.toLowerCase().includes(query)) ||
        (item.position_en && item.position_en.toLowerCase().includes(query)) ||
        (item.position_th && item.position_th.toLowerCase().includes(query))
      );
    });
  }, [orgData, searchQuery]);

  // Group Data
  const groupedByDept = useMemo(() => {
    return groupBy(filteredData, 'department_en');
  }, [filteredData]);

  // Auto-expand when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const allDepts: Record<string, boolean> = {};
      const allDivs: Record<string, boolean> = {};
      Object.keys(groupedByDept).forEach(dept => {
        allDepts[dept] = true;
        const divs = groupBy(groupedByDept[dept], 'division_en');
        Object.keys(divs).forEach(div => {
          allDivs[`${dept}-${div}`] = true;
        });
      });
      setExpandedDepts(allDepts);
      setExpandedDivs(allDivs);
    }
  }, [searchQuery, groupedByDept]);

  if (loading) {
    return (
      <div className="w-full py-12 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-white"></div>
        <span className="ml-3 text-slate-500 dark:text-slate-400">Loading organization structure...</span>
      </div>
    );
  }

  if (errorMsg) {
    return <div className="text-red-500 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">{errorMsg}</div>;
  }

  return (
    <div className="w-full space-y-4">
      {Object.entries(groupedByDept).map(([deptName, deptItems]: [string, any]) => {
        const isExpanded = expandedDepts[deptName];
        const groupedByDiv = groupBy(deptItems, 'division_en');
        const deptTh = deptItems[0]?.department_th || "";

        return (
          <div key={deptName} className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
            {/* Department Header */}
            <div 
              onClick={() => toggleDept(deptName)}
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">{deptName !== "Unknown" ? deptName : "Unassigned Department"}</h3>
                  {deptTh && deptTh !== "-" && <p className="text-sm text-slate-500 dark:text-slate-400">{deptTh}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-full">
                  {deptItems.length} Positions
                </span>
                <div className="text-slate-400">
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </div>
            </div>

            {/* Divisions */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#161616]"
                >
                  {Object.entries(groupedByDiv).map(([divName, divItems]: [string, any]) => {
                    const divKey = `${deptName}-${divName}`;
                    const isDivExpanded = expandedDivs[divKey];
                    const divTh = divItems[0]?.division_th || "";

                    return (
                      <div key={divKey} className="border-b border-slate-100 dark:border-white/5 last:border-0">
                        <div 
                          onClick={() => toggleDiv(divKey)}
                          className="flex items-center justify-between p-3 pl-8 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Layers className="w-4 h-4 text-slate-400" />
                            <div>
                              <h4 className="font-semibold text-slate-800 dark:text-slate-200">{divName !== "-" ? divName : "Direct to Department"}</h4>
                              {divTh && divTh !== "-" && <p className="text-xs text-slate-500">{divTh}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500">{divItems.length} items</span>
                            {isDivExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>

                        {/* Positions / Sections */}
                        <AnimatePresence>
                          {isDivExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-white/50 dark:bg-[#1A1A1A] py-2"
                            >
                              {divItems.map((item: OrgData, idx: number) => (
                                <div key={item.id || idx} className="pl-14 pr-4 py-2 flex items-start gap-3 hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors">
                                  <div className="mt-0.5">
                                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                      {item.position_en !== "-" ? item.position_en : item.position_th}
                                    </p>
                                    {item.position_th && item.position_th !== "-" && item.position_en !== "-" && (
                                      <p className="text-xs text-slate-500 truncate">{item.position_th}</p>
                                    )}
                                    
                                    {(item.section_en !== "-" || item.unit_en !== "-") && (
                                      <div className="flex items-center gap-2 mt-1">
                                        {item.section_en !== "-" && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/50 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                                            Sec: {item.section_en}
                                          </span>
                                        )}
                                        {item.unit_en !== "-" && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/50 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                                            Unit: {item.unit_en}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    {item.station && item.station !== "-" && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                        {item.station}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      
      {filteredData.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-[#121212] border border-slate-100 dark:border-white/5 rounded-2xl">
          <p className="text-slate-500 dark:text-slate-400">No organizational data found matching your search.</p>
        </div>
      )}
    </div>
  );
}
