"use client";

import { motion } from "framer-motion";
import { Search, X, RefreshCw } from "lucide-react";
import { EmployeeList } from "./components/EmployeeList";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo, useCallback } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";

export default function EmployeesPage() {
  const [activeTab, setActiveTab] = useState<"all" | "active" | "resigned" | "probation">("active");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Organization Filters State
  const [orgData, setOrgData] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStation, setSelectedStation] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");

  // Date Range Filter State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [employeeRefreshKey, setEmployeeRefreshKey] = useState(0);
  const [isRefreshingEmployees, setIsRefreshingEmployees] = useState(false);

  const dateRangeText = useMemo(() => {
    if (!startDate && !endDate) {
      return activeTab === "resigned" ? "ค้นหาวันลาออก..." : "ค้นหาวันเริ่มงาน...";
    }
    const formatLocal = (dStr: string) => {
      try {
        const d = new Date(dStr);
        if (isNaN(d.getTime())) return dStr;
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch (e) {
        return dStr;
      }
    };
    if (startDate && endDate) return `${formatLocal(startDate)} - ${formatLocal(endDate)}`;
    if (startDate) return `ตั้งแต่ ${formatLocal(startDate)}`;
    return `จนถึง ${formatLocal(endDate)}`;
  }, [startDate, endDate, activeTab]);

  useEffect(() => {
    fetch('/api/organization')
      .then(async (res) => {
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      })
      .then(setOrgData)
      .catch(() => setOrgData([]));
  }, []);

  const formatWithCode = (name: string, code: string) => {
    if (!name || name === "-") return "-";
    if (code && code !== "-") return `${name} (${code})`;
    return name;
  };

  const sortByCode = (a: string, b: string) => {
    const extractCode = (str: string) => {
      const match = str.match(/\(([^)]+)\)$/);
      return match ? match[1].trim() : str.trim();
    };
    return extractCode(a).localeCompare(extractCode(b), 'en');
  };

  const departments = useMemo(() => {
    return Array.from(new Set(orgData.map(item => formatWithCode(item.department_en, item.department_code)).filter(v => v && v !== "-"))).sort(sortByCode);
  }, [orgData]);

  const divisions = useMemo(() => {
    let filtered = orgData;
    if (selectedDepartment) {
      filtered = filtered.filter(item => formatWithCode(item.department_en, item.department_code) === selectedDepartment);
    }
    return Array.from(new Set(filtered.map(item => formatWithCode(item.division_en, item.division_code)).filter(v => v && v !== "-"))).sort(sortByCode);
  }, [orgData, selectedDepartment]);

  const sections = useMemo(() => {
    let filtered = orgData;
    if (selectedDepartment) filtered = filtered.filter(item => formatWithCode(item.department_en, item.department_code) === selectedDepartment);
    if (selectedDivision) filtered = filtered.filter(item => formatWithCode(item.division_en, item.division_code) === selectedDivision);
    return Array.from(new Set(filtered.map(item => formatWithCode(item.section_en, item.section_code)).filter(v => v && v !== "-"))).sort(sortByCode);
  }, [orgData, selectedDepartment, selectedDivision]);

  const stations = useMemo(() => {
    return Array.from(new Set(orgData.map(item => item.station).filter(v => v && v !== "-"))).sort((a, b) => a.localeCompare(b, 'en'));
  }, [orgData]);

  const units = useMemo(() => {
    let filtered = orgData;
    if (selectedDepartment) filtered = filtered.filter(item => formatWithCode(item.department_en, item.department_code) === selectedDepartment);
    if (selectedDivision) filtered = filtered.filter(item => formatWithCode(item.division_en, item.division_code) === selectedDivision);
    if (selectedSection) filtered = filtered.filter(item => formatWithCode(item.section_en, item.section_code) === selectedSection);
    return Array.from(new Set(filtered.map(item => formatWithCode(item.unit_en, item.unit_code)).filter(v => v && v !== "-"))).sort(sortByCode);
  }, [orgData, selectedDepartment, selectedDivision, selectedSection]);
  const hasActiveFilters = Boolean(selectedDepartment || selectedDivision || selectedSection || selectedStation || selectedUnit || searchQuery || startDate || endDate);

  const handleRefreshEmployees = useCallback(() => {
    setEmployeeRefreshKey((key) => key + 1);
  }, []);

  const handleEmployeeRefreshStateChange = useCallback((refreshing: boolean) => {
    setIsRefreshingEmployees(refreshing);
  }, []);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6 px-3 py-4 sm:space-y-8 sm:p-8">
      {/* Tabs */}
      <div className="flex w-full min-w-0 justify-center">
        <div className="grid w-full min-w-0 grid-cols-4 rounded-full border border-slate-100 bg-white p-1 shadow-sm dark:border-white/5 dark:bg-[#121212] sm:w-auto sm:p-1.5">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "min-w-0 rounded-full px-2 py-2 text-xs font-semibold transition-all duration-300 sm:px-6 sm:text-sm",
              activeTab === "all"
                ? "bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A]"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={cn(
              "min-w-0 rounded-full px-2 py-2 text-xs font-semibold transition-all duration-300 sm:px-6 sm:text-sm",
              activeTab === "active"
                ? "bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A]"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            Active
          </button>
          <button
            onClick={() => setActiveTab("probation")}
            className={cn(
              "min-w-0 rounded-full px-2 py-2 text-xs font-semibold transition-all duration-300 sm:px-6 sm:text-sm",
              activeTab === "probation"
                ? "bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A]"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            Probation
          </button>
          <button
            onClick={() => setActiveTab("resigned")}
            className={cn(
              "min-w-0 rounded-full px-2 py-2 text-xs font-semibold transition-all duration-300 sm:px-6 sm:text-sm",
              activeTab === "resigned"
                ? "bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A]"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            Resigning
          </button>
        </div>
      </div>

      {/* Filters */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 md:grid-cols-5"
      >
        <CustomSelect 
          value={selectedDepartment} 
          onChange={(v) => { setSelectedDepartment(v); setSelectedDivision(""); setSelectedSection(""); setSelectedUnit(""); }} 
          options={departments} 
          placeholder="All Departments" 
          triggerClassName="rounded-full px-4 py-2.5"
        />
        <CustomSelect 
          value={selectedDivision} 
          onChange={(v) => { setSelectedDivision(v); setSelectedSection(""); setSelectedUnit(""); }} 
          options={divisions} 
          placeholder="All Divisions" 
          triggerClassName="rounded-full px-4 py-2.5"
        />
        <CustomSelect 
          value={selectedSection} 
          onChange={(v) => { setSelectedSection(v); setSelectedUnit(""); }} 
          options={sections} 
          placeholder="All Sections" 
          triggerClassName="rounded-full px-4 py-2.5"
        />
        <CustomSelect 
          value={selectedUnit} 
          onChange={setSelectedUnit} 
          options={units} 
          placeholder="All Units" 
          triggerClassName="rounded-full px-4 py-2.5"
        />
        <CustomSelect 
          value={selectedStation} 
          onChange={setSelectedStation} 
          options={stations} 
          placeholder="All Stations" 
          triggerClassName="rounded-full px-4 py-2.5"
        />
        
        <div className="md:col-span-1 relative">
          <button
            type="button"
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-full px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-white/20 text-left truncate flex justify-between items-center cursor-pointer"
          >
            <span className="truncate pr-2">{dateRangeText}</span>
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          
          {isDatePickerOpen && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setIsDatePickerOpen(false)} />
              <div className="absolute top-full left-0 mt-2 w-[min(18rem,calc(100vw-1.5rem))] bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-50 p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">จากวันที่ (Start Date)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">ถึงวันที่ (End Date)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                      setIsDatePickerOpen(false);
                    }}
                    className="flex-1 py-1.5 border border-slate-200 dark:border-white/10 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    ล้างค่า
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(false)}
                    className="flex-1 py-1.5 bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A] rounded-full text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    ตกลง
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="md:col-span-3 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input 
            type="text" 
            placeholder="Search by name, ID, or component..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-full pl-10 pr-10 py-2.5 text-sm text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-white/20"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <div className="md:col-span-1 flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshEmployees}
            disabled={isRefreshingEmployees}
            className={cn(
              "flex items-center justify-center gap-2 h-full min-h-[40px] bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/10 dark:hover:bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-100 dark:border-sky-500/20 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-70",
              hasActiveFilters ? "flex-1" : "w-full"
            )}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshingEmployees && "animate-spin")} />
            Refresh
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSelectedDepartment("");
                setSelectedDivision("");
                setSelectedSection("");
                setSelectedStation("");
                setSelectedUnit("");
                setSearchQuery("");
                setStartDate("");
                setEndDate("");
              }}
              className="flex flex-1 items-center justify-center gap-2 h-full min-h-[40px] bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 rounded-full px-4 text-sm font-medium transition-colors"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
      </motion.div>

      {/* List */}
      <EmployeeList 
        activeTab={activeTab}
        searchQuery={searchQuery} 
        departmentFilter={selectedDepartment}
        divisionFilter={selectedDivision}
        sectionFilter={selectedSection}
        stationFilter={selectedStation}
        unitFilter={selectedUnit}
        startDateFilter={startDate}
        endDateFilter={endDate}
        refreshKey={employeeRefreshKey}
        onRefreshStateChange={handleEmployeeRefreshStateChange}
      />
    </div>
  );
}
