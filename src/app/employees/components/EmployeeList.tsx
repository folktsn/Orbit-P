"use client";

import { useState, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { Briefcase, Building2, MapPin, ChevronRight, AlertCircle, Clock, Calendar, SearchX } from "lucide-react";
import { EmployeeProfileDrawer, EmployeeData } from "./EmployeeProfileDrawer";
import { cn } from "@/lib/utils";
import {
  compareDepartureRecords,
  getDepartureState,
  isDepartureRecord,
  parseEmployeeDate,
} from "../lib/resignation";
import { filterEmployeeRecords, type EmployeeFilterRecord } from "../lib/search";
import styles from "../EmployeesWorkspace.module.css";

function EmployeeStatus({ employee, activeTab }: { employee: EmployeeData & { diffDays?: number }; activeTab: EmployeeListProps["activeTab"] }) {
  let label = employee.status?.trim() || "Unknown";
  let tone = label.toLowerCase() === "active" ? "active" : "neutral";
  let Icon = Calendar;

  if (activeTab === "resigned") {
    const { kind, date, days } = getDepartureState(employee);
    const formattedDate = date?.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
    label = kind === "completed" ? "ลาออกแล้ว"
      : kind === "failed-probation" ? "ไม่ผ่านทดลองงาน"
        : kind === "overdue" ? `เลยกำหนดวันลาออก ${Math.abs(days)} วัน`
          : kind === "today" ? "ลาออกวันนี้"
            : kind === "upcoming" ? `ลาออกใน ${days} วัน` : "อยู่ระหว่างลาออก";
    label += formattedDate ? ` (${formattedDate})` : " · ไม่ระบุวันที่";
    tone = kind === "overdue" || kind === "failed-probation" ? "danger"
      : kind === "today" || (kind === "upcoming" && days <= 30) ? "warning" : "neutral";
    Icon = tone === "danger" ? AlertCircle : kind === "today" ? Clock : Calendar;
  } else if (activeTab === "retirement" && employee.retirementAge !== undefined) {
    label = employee.turnsSixtyThisYear ? "ครบ 60 ปีในปีนี้" : `อายุ ${employee.retirementAge} ปี`;
    tone = "warning";
  } else if (activeTab === "active" && employee.diffDays !== undefined) {
    const days = employee.diffDays;
    label = days < 0 ? `เลยกำหนด ${Math.abs(days)} วัน`
      : days === 0 ? "ครบกำหนดวันนี้"
        : days <= 30 ? `เหลืออีก ${days} วัน (วิกฤต)` : `เหลืออีก ${days} วัน`;
    tone = days < 0 ? "danger" : days <= 30 ? "warning" : "info";
    Icon = days < 0 ? AlertCircle : days === 0 ? Clock : Calendar;
  }

  return (
    <span className={styles.employeeStatus} data-tone={tone}>
      {tone === "active" ? <span className={styles.statusDot} /> : <Icon size={13} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}

// Helper to generate initials from English first and last name.
const getInitials = (name: string) => {
  if (!name || name === "-") return "EMP";
  const titlePrefixes = new Set(["mr", "mr.", "mrs", "mrs.", "miss", "ms", "ms.", "dr", "dr."]);
  const parts = name
    .trim()
    .replace(/^[.\s-]+/, "")
    .split(/\s+/)
    .filter((part) => part && !titlePrefixes.has(part.toLowerCase()));

  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  return (parts[0] || "EMP").substring(0, 2).toUpperCase();
};

// Helper to assign a random color class based on ID
const getColorClass = (id: string) => {
  const colors = ["bg-emerald-500", "bg-blue-500", "bg-pink-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-indigo-500"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// Helper to combine Thai and English strings
const getDualLanguage = (th: any, en: any, fallback: any) => {
  const clean = (value: unknown) => {
    const text = String(value ?? "").trim();
    return ["-", "null", "undefined"].includes(text.toLowerCase()) ? "" : text;
  };
  const safeTh = clean(th);
  const safeEn = clean(en);
  
  if (safeTh && safeEn && safeTh !== "-" && safeEn !== "-" && safeTh.toLowerCase() !== safeEn.toLowerCase()) {
    return `${safeTh} / ${safeEn}`;
  }
  return safeTh || safeEn || clean(fallback) || "-";
};

interface EmployeeListProps {
  activeTab: "all" | "active" | "resigned" | "retirement";
  searchQuery?: string;
  departmentFilter?: string;
  divisionFilter?: string;
  sectionFilter?: string;
  stationFilter?: string;
  unitFilter?: string;
  startDateFilter?: string;
  endDateFilter?: string;
  refreshKey?: number;
  onRefreshStateChange?: (refreshing: boolean) => void;
  onFilterRecordsChange?: (records: EmployeeFilterRecord[]) => void;
}

export function EmployeeList({ 
  activeTab,
  searchQuery = "",
  departmentFilter = "",
  divisionFilter = "",
  sectionFilter = "",
  stationFilter = "",
  unitFilter = "",
  startDateFilter = "",
  endDateFilter = "",
  refreshKey = 0,
  onRefreshStateChange,
  onFilterRecordsChange,
}: EmployeeListProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [visibleCount, setVisibleCount] = useState(25);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const openEmployee = (employee: EmployeeData) => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setSelectedEmployee(employee);
    setIsDrawerOpen(true);
  };

  const closeEmployeeDrawer = () => {
    setIsDrawerOpen(false);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setSelectedEmployee(null);
    }, 220);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchEmployees() {
      const isManualRefresh = refreshKey > 0;
      if (isManualRefresh) {
        onRefreshStateChange?.(true);
      } else {
        setLoading(true);
      }

      try {
        const empRes = await fetch("/api/employees", { cache: "no-store", signal: controller.signal });

        if (!empRes.ok) {
          throw new Error("Failed to fetch from DynamoDB");
        }
        
        const data = await empRes.json();
        if (!Array.isArray(data)) throw new Error("Invalid employee list response");
        if (controller.signal.aborted) return;
        
        if (data && data.length > 0) {
          // Map DynamoDB data to the EmployeeData interface
          // Modify this mapping based on your exact Fullstaff table structure
          const mappedData: EmployeeData[] = data.map((item: any) => {
            const hasProfileValue = (value: any) => (
              value !== undefined &&
              value !== null &&
              String(value).trim() !== "" &&
              String(value).trim() !== "-" &&
              String(value).trim() !== "undefined" &&
              String(value).trim() !== "null"
            );
            const cleanProfileValue = (value: any) => hasProfileValue(value) ? String(value).trim() : "";

            let rawThTitle = cleanProfileValue(item.title_th);
            let rawEnTitle = cleanProfileValue(item.title_en);
            
            // Prioritize building the name from first_name_th and last_name_th
            let baseThName = "";
            const thFirst = cleanProfileValue(item.first_name_th);
            const thLast = cleanProfileValue(item.last_name_th);
            if (thFirst || thLast) {
              baseThName = `${thFirst} ${thLast}`.trim();
            }
            if (!baseThName && hasProfileValue(item.name_th)) {
              baseThName = item.name_th.trim();
            }
            if (!baseThName) {
              baseThName = hasProfileValue(item.name) ? item.name : "Unknown";
            }

            // Prioritize building the name from first_name_en and last_name_en
            let baseEnName = "";
            const enFirst = cleanProfileValue(item.first_name_en);
            const enLast = cleanProfileValue(item.last_name_en);
            if (enFirst || enLast) {
              baseEnName = `${enFirst} ${enLast}`.trim();
            }
            if (!baseEnName && hasProfileValue(item.name_en)) {
              baseEnName = item.name_en.trim();
            }
            if (!baseEnName) {
              baseEnName = "-";
            }

            // Identify EN title from name if missing
            if (!rawEnTitle) {
               if (/^mr\.?\s/i.test(baseEnName)) rawEnTitle = "Mr.";
               else if (/^mrs\.?\s/i.test(baseEnName)) rawEnTitle = "Mrs.";
               else if (/^miss\s/i.test(baseEnName)) rawEnTitle = "Miss";
               else if (/^ms\.?\s/i.test(baseEnName)) rawEnTitle = "Ms.";
            }

            // Normalize EN title format
            rawEnTitle = rawEnTitle.replace(/\s*\.\s*/g, ".");
            if (['Mr', 'Mrs', 'Ms'].includes(rawEnTitle)) rawEnTitle += '.';

            // Identify TH title from name if missing
            if (!rawThTitle) {
               if (baseThName.startsWith("นาย")) rawThTitle = "นาย";
               else if (baseThName.startsWith("นางสาว")) rawThTitle = "นางสาว";
               else if (baseThName.startsWith("นาง")) rawThTitle = "นาง";
            }

            // Aggressively remove leading dots, spaces, hyphens, and repeated titles
            let cleanThName = baseThName.replace(/^[\s\.\-]+/, "").replace(/^(?:(?:นาย|นางสาว|นาง)[\s\.\-]*)+/, "").trim();
            let cleanEnName = baseEnName.replace(/^[\s\.\-]+/, "").replace(/^(?:(?:Mr\.|Mr|Mrs\.|Mrs|Miss|Ms\.|Ms)[\s\.\-]*)+/i, "").trim();

            if (!cleanThName) cleanThName = "-";
            if (!cleanEnName) cleanEnName = "-";

            const splitProfileName = (value: string) => {
              if (!value || value === "-") return { first: "", last: "" };
              const parts = value.split(/\s+/).filter(Boolean);
              return {
                first: parts[0] || "",
                last: parts.slice(1).join(" "),
              };
            };
            const thNameParts = splitProfileName(cleanThName);
            const enNameParts = splitProfileName(cleanEnName);
            const mappedFirstNameTh = thFirst || thNameParts.first || undefined;
            const mappedLastNameTh = thLast || thNameParts.last || undefined;
            const mappedFirstNameEn = enFirst || enNameParts.first || undefined;
            const mappedLastNameEn = enLast || enNameParts.last || undefined;

            const displayName = rawThTitle && cleanThName !== "-" ? `${rawThTitle}${cleanThName}` : cleanThName;
            // Ensure format like Mr. Chayanut (or fallback if no title)
            const displayNameEn = rawEnTitle && cleanEnName !== "-" ? `${rawEnTitle}${rawEnTitle.endsWith('.') ? '' : '.'} ${cleanEnName}` : cleanEnName;
            
            const empId = String(item.emp_code || item.staff_id || item.employeeId || item.id || "N/A").trim();
            const mappedTitle = getDualLanguage(item.position_th, item.position_en, item.position || item.title);
            
            const empIdStr = String(empId);
            // Business Rule:
            // 1. Employees in "Agent level" positions (contains "Agent" or "เจ้าหน้าที่", e.g. Wheelchair Service Agent) are NOT contractors, even if their ID starts with "80".
            //    They are subject to normal probation tracking (showing as "Probation" or "Normal" after passing).
            // 2. Only employees whose ID starts with "80" in "Staff level" positions (e.g. Wheelchair Service Staff, Wheelchair Center) are contractors (excluded from probation).
            const isAgent = 
              (item.position_th && item.position_th.includes("เจ้าหน้าที่")) ||
              (item.position_en && item.position_en.toLowerCase().includes("agent")) ||
              (item.position && (item.position.includes("เจ้าหน้าที่") || item.position.toLowerCase().includes("agent"))) ||
              (item.title && (item.title.includes("เจ้าหน้าที่") || item.title.toLowerCase().includes("agent"))) ||
              (mappedTitle && (mappedTitle.includes("เจ้าหน้าที่") || mappedTitle.toLowerCase().includes("agent")));

            const isContractor = empIdStr.startsWith("80") && !isAgent;
            const lineAvatarUrl = undefined;
            
            return {
              id: empId,
              name: displayName,
              nameEn: displayNameEn,
              initials: getInitials(cleanEnName),
              colorClass: getColorClass(empId),
              title: mappedTitle,
              department: getDualLanguage(item.department_th, item.department_en, item.department),
              station: cleanProfileValue(item.station) || getDualLanguage(item.station_th, item.station_en, item.work_location),
              division: getDualLanguage(item.division_th, item.division_en, item.division),
              section: getDualLanguage(item.section_th, item.section_en, item.section),
              unit: getDualLanguage(item.unit_th, item.unit_en, item.unit),
              supervisor: item.supervisor || "-",
              status: item.status || "Active",
              empType: isContractor ? "Contractor" : (item.emp_type || "Normal"),
              contractStart: item.start_date || item.hire_date || item.contractStart || "-",
              contractEnd: item.contractEnd || "-",
              probationDays: item.probation_days || item.probation_day || item.probation_period_days || item.probation_duration_days || item.probation_total_days || item.prob_days || item.prob_period || "-",
              probationEnd: isContractor ? "-" : (() => {
                let probEnd = item.probation_end_date || item.probation_end || "-";
                const startDateStr = item.start_date || item.hire_date || item.contractStart || "-";
                if ((!probEnd || probEnd === "-") && startDateStr && startDateStr !== "-") {
                  const startDate = new Date(startDateStr);
                  if (!isNaN(startDate.getTime())) {
                    const calculatedProbEnd = new Date(startDate.getTime() + 118 * 24 * 60 * 60 * 1000);
                    const yyyy = calculatedProbEnd.getFullYear();
                    const mm = String(calculatedProbEnd.getMonth() + 1).padStart(2, '0');
                    const dd = String(calculatedProbEnd.getDate()).padStart(2, '0');
                    probEnd = `${yyyy}-${mm}-${dd}`;
                  }
                }
                return probEnd;
              })(),
              gender: item.gender || "-",
              nationality: item.nationality || "Thai",
              birthDate: item.birth_date || "-",
              age: item.age,
              idCard: item.id_card || "-",
              email: item.email || "-",
              phone: item.phone || "-",
              address: item.address || "-",
              emergencyContact: cleanProfileValue(item.emergency_contact) || "-",
              emergencyContactName: cleanProfileValue(item.emergency_contact_name) || cleanProfileValue(item.emergency_name) || cleanProfileValue(item.contact_person),
              emergencyContactRelation: cleanProfileValue(item.emergency_contact_relation) || cleanProfileValue(item.emergency_relation) || cleanProfileValue(item.contact_relation),
              emergencyContactPhone: cleanProfileValue(item.emergency_contact_phone) || cleanProfileValue(item.emergency_phone) || cleanProfileValue(item.contact_phone),
              education: item.education || "-",
              workHistory: item.work_history || "-",
              resignDate: item.resign_date || item.last_working_date || item.separation_date || item.last_work_date || "-",
              resignStatus: item.resign_status || "-",
              separationType: item.separation_type || "-",
              separationDate: item.separation_date || "-",
              lastWorkDate: item.last_work_date || "-",
              probationOutcome: item.probation_outcome || "-",
              lastWorkingDate: item.last_working_date || item.last_work_date || "-",
              probationExtensionDays: item.probation_extension_days || "-",
              probationPassOperatorId: item.probation_pass_operator_id || "-",
              probationPassOperatorName: item.probation_pass_operator_name || "-",
              probationPassOperatorPosition: item.probation_pass_operator_position || "-",
              probationPassDate: item.probation_pass_date || "-",
              probationPassAttachmentName: item.probation_pass_attachment_name || "-",
              probationPassAttachmentData: item.probation_pass_attachment_data || "-",
              bankAccount: item.bank_account_no || item.bank_account || "-",
              lineUserId: item.line_user_id || "-",
              attachmentName: item.attachment_name || "-",
              attachmentData: item.attachment_data || "-",
              lineAvatarUrl,
              titlePrefix: rawThTitle && rawEnTitle ? `${rawThTitle} / ${rawEnTitle}` : undefined,
              firstNameTh: mappedFirstNameTh,
              lastNameTh: mappedLastNameTh,
              firstNameEn: mappedFirstNameEn,
              lastNameEn: mappedLastNameEn,
            };
          });
          
          // Sort employees by ID (ascending)
          mappedData.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
          
          setEmployees(mappedData);
          setErrorMsg(null);
        } else {
          setEmployees([]);
          setErrorMsg(null);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to load employees:", error);
        setErrorMsg("ไม่สามารถโหลดรายชื่อพนักงานล่าสุดได้ กรุณากด Refresh เพื่อลองอีกครั้ง");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (isManualRefresh) onRefreshStateChange?.(false);
        }
      }
    }

    fetchEmployees();
    return () => controller.abort();
  }, [refreshKey, onRefreshStateChange]);

  // Reset pagination when activeTab, search query or filters change
  useEffect(() => {
    setVisibleCount(25);
  }, [activeTab, searchQuery, departmentFilter, divisionFilter, sectionFilter, stationFilter, unitFilter, startDateFilter, endDateFilter]);

  const tabEmployees = useMemo(() => {
    let result = employees;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter by activeTab first
    if (activeTab === "active") {
      result = result.filter(emp => emp.status && emp.status.trim().toLowerCase() === "active");
      
      // Calculate remaining probation days if they are on probation
      result = result.map(emp => {
        const isProbation = 
          !emp.status.toLowerCase().includes("resign") &&
          (!emp.resignDate || emp.resignDate === "-") &&
          emp.empType && emp.empType.toLowerCase() === "probation" &&
          emp.probationEnd && emp.probationEnd !== "-";
          
        if (isProbation) {
          const pDate = new Date(emp.probationEnd);
          if (!isNaN(pDate.getTime())) {
            pDate.setHours(0, 0, 0, 0);
            const diffTime = pDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            (emp as any).diffDays = diffDays;
          }
        }
        return emp;
      });
    } else if (activeTab === "resigned") {
      result = result.filter(isDepartureRecord);
      result = [...result].sort((a, b) => compareDepartureRecords(a, b, today));
    } else if (activeTab === "retirement") {
      const currentYear = today.getFullYear();

      result = result.filter(emp => {
        if ((emp.status || "").trim().toLowerCase() !== "active") return false;

        const birthDate = parseEmployeeDate(emp.birthDate);
        if (birthDate) {
          const retirementYear = birthDate.getFullYear() + 60;
          if (retirementYear > currentYear) return false;

          const birthdayPassed =
            today.getMonth() > birthDate.getMonth() ||
            (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
          const currentAge = currentYear - birthDate.getFullYear() - (birthdayPassed ? 0 : 1);

          emp.retirementYear = retirementYear;
          emp.retirementAge = currentAge;
          emp.turnsSixtyThisYear = retirementYear === currentYear;
          return true;
        }

        const storedAge = Number(emp.age);
        if (!Number.isFinite(storedAge) || storedAge < 60) return false;

        emp.retirementYear = currentYear - Math.max(0, storedAge - 60);
        emp.retirementAge = storedAge;
        emp.turnsSixtyThisYear = false;
        return true;
      });

      result = [...result].sort((a, b) => {
        const retirementYearDiff = (b.retirementYear ?? 0) - (a.retirementYear ?? 0);
        if (retirementYearDiff !== 0) return retirementYearDiff;
        return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" });
      });
    }

    return result;
  }, [employees, activeTab]);

  useEffect(() => {
    onFilterRecordsChange?.(tabEmployees);
  }, [tabEmployees, onFilterRecordsChange]);

  const filteredEmployees = useMemo(() => filterEmployeeRecords(tabEmployees, {
      searchQuery, departmentFilter, divisionFilter, sectionFilter, stationFilter, unitFilter,
      startDateFilter, endDateFilter, dateField: activeTab === "resigned" ? "departure" : "start",
    }), [tabEmployees, activeTab, searchQuery, departmentFilter, divisionFilter, sectionFilter, stationFilter, unitFilter, startDateFilter, endDateFilter]);

  return (
    <div className={styles.directory}>
      <header className={styles.resultsHeading}>
        <div>
          <span className={styles.eyebrow}>EMPLOYEES / {activeTab.toUpperCase()}</span>
          <h2>{activeTab === "resigned" ? "พนักงานลาออกและอยู่ระหว่างลาออก" : activeTab === "retirement" ? "พนักงานเกษียณอายุ" : "รายชื่อพนักงาน"}</h2>
        </div>
        {!loading && !errorMsg && (
          <span role="status" className={styles.resultCount}>
            {filteredEmployees.length.toLocaleString("th-TH")} คน
          </span>
        )}
      </header>

      {errorMsg && <div role="alert" className={styles.errorState}><AlertCircle size={20} aria-hidden="true" /><p>{errorMsg}</p></div>}

      {loading ? (
        <div className={styles.loadingState} role="status" aria-label="กำลังโหลดข้อมูลพนักงาน">
          <p>กำลังโหลดข้อมูลพนักงาน...</p>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className={styles.skeletonCard} aria-hidden="true">
              <span /><div><i /><i /><i /></div>
            </div>
          ))}
        </div>
      ) : !errorMsg && filteredEmployees.length === 0 ? (
        <div className={styles.emptyState}>
          <SearchX size={32} aria-hidden="true" />
          <h3>ไม่พบพนักงานตามเงื่อนไขที่เลือก</h3>
        </div>
      ) : !errorMsg && (
        <ul className={styles.employeeStack} aria-label="ผลการค้นหาพนักงาน">
          {filteredEmployees.slice(0, visibleCount).map((emp, index) => (
            <li
              key={emp.id}
              className={styles.employeeItem}
              style={{ "--entry-delay": `${Math.min(index, 8) * 25}ms` } as CSSProperties}
            >
              <article className={styles.employeeCard}>
                <button
                  type="button"
                  className={styles.openEmployee}
                  onClick={() => openEmployee(emp)}
                  aria-label={`เปิดข้อมูลพนักงาน ${emp.nameEn !== "-" ? emp.nameEn : emp.name} (${emp.id})`}
                />
                <div className={styles.employeeIdentity}>
                  <div className={cn(styles.avatar, emp.colorClass)} aria-hidden="true">{emp.initials}</div>
                  <div className={styles.employeeName}>
                    <p className={styles.employeeId}>ID: {emp.id}</p>
                    <h3 title={emp.nameEn !== "-" ? emp.nameEn : emp.name}>{emp.nameEn !== "-" ? emp.nameEn : emp.name}</h3>
                    {emp.nameEn !== "-" && <p className={styles.thaiName} title={emp.name}>{emp.name}</p>}
                  </div>
                </div>
                <div className={styles.employeeWork}>
                  <p title={emp.title}><Briefcase size={15} aria-hidden="true" /><span>{emp.title}</span></p>
                  <p title={emp.department}><Building2 size={15} aria-hidden="true" /><span>{emp.department}</span></p>
                </div>
                <ChevronRight className={styles.cardArrow} size={18} aria-hidden="true" />
                <footer className={styles.employeeFooter}>
                  <span className={styles.station}><MapPin size={13} aria-hidden="true" /><span>{emp.station || "-"}</span></span>
                  <div className={styles.employeeBadges}>
                    {emp.empType && emp.empType !== "-" && <span className={styles.employeeType}>{emp.empType}</span>}
                    <EmployeeStatus employee={emp} activeTab={activeTab} />
                  </div>
                </footer>
              </article>
            </li>
          ))}
        </ul>
      )}

      {!loading && !errorMsg && visibleCount < filteredEmployees.length && (
        <div className={styles.pagination}>
          <button type="button" onClick={() => setVisibleCount(prev => prev + 25)}>
            Load More ({filteredEmployees.length - visibleCount} remaining)
          </button>
        </div>
      )}

      <EmployeeProfileDrawer
        isOpen={isDrawerOpen}
        onClose={closeEmployeeDrawer}
        employee={selectedEmployee}
        onUpdate={(updatedData) => {
          setEmployees(prev => prev.map(e => e.id === updatedData.id ? updatedData : e));
          setSelectedEmployee(updatedData);
          setIsDrawerOpen(true);
        }}
      />
    </div>
  );
}
