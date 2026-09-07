"use client";

import { Search, X, RefreshCw, CalendarDays, SlidersHorizontal, ChevronDown, UsersRound } from "lucide-react";
import { EmployeeList } from "./components/EmployeeList";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo, useCallback } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { getEmployeeFilterOptions, type EmployeeFilterRecord } from "./lib/search";
import styles from "./EmployeesWorkspace.module.css";

export default function EmployeesPage() {
  const [activeTab, setActiveTab] = useState<"all" | "active" | "resigned" | "retirement">("active");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Organization Filters State
  const [orgData, setOrgData] = useState<any[]>([]);
  const [filterRecords, setFilterRecords] = useState<EmployeeFilterRecord[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStation, setSelectedStation] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");

  // Date Range Filter State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [employeeRefreshKey, setEmployeeRefreshKey] = useState(0);
  const [isRefreshingEmployees, setIsRefreshingEmployees] = useState(false);
  const invalidDateRange = Boolean(startDate && endDate && startDate > endDate);

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
    const initialQuery = new URLSearchParams(window.location.search).get("q");
    const frame = initialQuery
      ? requestAnimationFrame(() => setSearchQuery(initialQuery))
      : null;

    fetch('/api/organization')
      .then(async (res) => {
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      })
      .then(setOrgData)
      .catch(() => setOrgData([]));

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  const formatWithCode = (name: string, code: string) => {
    if (!name || name === "-") return "-";
    if (code && code !== "-") return `${name} (${code})`;
    return name;
  };

  const preferredLabels = useMemo(() => ({
    department: [...new Set(orgData.map((item) => formatWithCode(item.department_en, item.department_code)))],
    division: [...new Set(orgData.map((item) => formatWithCode(item.division_en, item.division_code)))],
    section: [...new Set(orgData.map((item) => formatWithCode(item.section_en, item.section_code)))],
    unit: [...new Set(orgData.map((item) => formatWithCode(item.unit_en, item.unit_code)))],
    station: [...new Set(orgData.map((item) => String(item.station ?? "").trim()))],
  }), [orgData]);

  const { departments, divisions, sections, units, stations } = useMemo(() => getEmployeeFilterOptions(
    filterRecords,
    { departmentFilter: selectedDepartment, divisionFilter: selectedDivision, sectionFilter: selectedSection },
    preferredLabels,
  ), [filterRecords, selectedDepartment, selectedDivision, selectedSection, preferredLabels]);
  const hasActiveFilters = Boolean(selectedDepartment || selectedDivision || selectedSection || selectedStation || selectedUnit || searchQuery || startDate || endDate);

  const handleRefreshEmployees = useCallback(() => {
    setEmployeeRefreshKey((key) => key + 1);
  }, []);

  const handleEmployeeRefreshStateChange = useCallback((refreshing: boolean) => {
    setIsRefreshingEmployees(refreshing);
  }, []);

  const filterCount = [selectedDepartment, selectedDivision, selectedSection, selectedUnit, selectedStation, startDate || endDate].filter(Boolean).length;

  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="ค้นหาและกรองพนักงาน">
        <header className={styles.sidebarHeading}>
          <span className={styles.eyebrow}><UsersRound size={16} aria-hidden="true" /> PEOPLE DIRECTORY</span>
          <h1>Employees</h1>
          <p>ข้อมูลพนักงาน</p>
        </header>

        <div className={styles.statusTabs} role="group" aria-label="สถานะพนักงาน">
          {([
            ["all", "All"], ["active", "Active"],
            ["retirement", "Retirement"], ["resigned", "Resign"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setActiveTab(value)} aria-pressed={activeTab === value}>
              {label}
            </button>
          ))}
        </div>

        <div className={styles.searchField}>
          <Search size={18} aria-hidden="true" />
          <input
            type="text"
            placeholder="ชื่อ รหัส หรือหน่วยงาน..."
            aria-label="ค้นหาพนักงาน"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} type="button" aria-label="ล้างคำค้นหา" title="ล้างคำค้นหา">
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          type="button"
          className={styles.filterToggle}
          aria-expanded={filtersExpanded}
          aria-controls="employee-advanced-filters"
          onClick={() => setFiltersExpanded((expanded) => !expanded)}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          ตัวกรองเพิ่มเติม {filterCount > 0 && <span className={styles.filterCount}>{filterCount}</span>}
          <ChevronDown size={16} aria-hidden="true" />
        </button>

        <div id="employee-advanced-filters" className={styles.advancedFilters} data-expanded={filtersExpanded}>
          <div className={styles.filterSectionHeading}>
            <SlidersHorizontal size={15} aria-hidden="true" />
            <h2>ตัวกรอง</h2>
            {filterCount > 0 && <span className={styles.filterCount}>{filterCount}</span>}
          </div>
          <div className={styles.filterFields}>
            <div className={styles.filterField}>
              <span>ฝ่าย / Department</span>
              <CustomSelect value={selectedDepartment} onChange={(v) => { setSelectedDepartment(v); setSelectedDivision(""); setSelectedSection(""); setSelectedUnit(""); }} options={departments} placeholder="All Departments" triggerClassName={styles.selectTrigger} />
            </div>
            <div className={styles.filterField}>
              <span>แผนก / Division</span>
              <CustomSelect value={selectedDivision} onChange={(v) => { setSelectedDivision(v); setSelectedSection(""); setSelectedUnit(""); }} options={divisions} placeholder="All Divisions" triggerClassName={styles.selectTrigger} />
            </div>
            <div className={styles.filterField}>
              <span>ส่วนงาน / Section</span>
              <CustomSelect value={selectedSection} onChange={(v) => { setSelectedSection(v); setSelectedUnit(""); }} options={sections} placeholder="All Sections" triggerClassName={styles.selectTrigger} />
            </div>
            <div className={styles.filterField}>
              <span>หน่วยงาน / Unit</span>
              <CustomSelect value={selectedUnit} onChange={setSelectedUnit} options={units} placeholder="All Units" triggerClassName={styles.selectTrigger} />
            </div>
            <div className={styles.filterField}>
              <span>สถานี / Station</span>
              <CustomSelect value={selectedStation} onChange={setSelectedStation} options={stations} placeholder="All Stations" triggerClassName={styles.selectTrigger} />
            </div>
            <div className={styles.filterField}>
              <span>{activeTab === "resigned" ? "วันที่ลาออก" : "วันที่เริ่มงาน"}</span>
              <button
                type="button"
                className={styles.dateTrigger}
                aria-expanded={isDatePickerOpen}
                aria-controls="employee-date-range"
                onClick={() => setIsDatePickerOpen((open) => !open)}
              >
                <span>{dateRangeText}</span>
                <CalendarDays size={16} aria-hidden="true" />
              </button>
              {isDatePickerOpen && (
                <div id="employee-date-range" className={styles.dateRange} onKeyDown={(e) => { if (e.key === "Escape") setIsDatePickerOpen(false); }}>
                  <label htmlFor="employees-filter-start">จากวันที่ (Start Date)</label>
                  <input id="employees-filter-start" type="date" max={endDate || undefined} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <label htmlFor="employees-filter-end">ถึงวันที่ (End Date)</label>
                  <input id="employees-filter-end" type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  <div className={styles.dateActions}>
                    <button type="button" onClick={() => { setStartDate(""); setEndDate(""); setIsDatePickerOpen(false); }}>ล้างค่า</button>
                    <button type="button" onClick={() => setIsDatePickerOpen(false)}>ตกลง</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {invalidDateRange && <p role="alert" className={styles.filterError}>วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด</p>}
        </div>

        <div className={styles.filterActions}>
          <button type="button" onClick={handleRefreshEmployees} disabled={isRefreshingEmployees} className={styles.refreshButton}>
            <RefreshCw size={16} aria-hidden="true" className={cn(isRefreshingEmployees && "animate-spin")} />
            Refresh
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={() => {
                setSelectedDepartment(""); setSelectedDivision(""); setSelectedSection("");
                setSelectedStation(""); setSelectedUnit(""); setSearchQuery("");
                setStartDate(""); setEndDate(""); setIsDatePickerOpen(false);
              }}
            >
              <X size={16} aria-hidden="true" /> Clear
            </button>
          )}
        </div>
      </aside>

      <section className={styles.results} aria-label="รายชื่อพนักงาน">
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
          onFilterRecordsChange={setFilterRecords}
        />
      </section>
    </div>
  );
}
