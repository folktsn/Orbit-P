"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Briefcase, ChevronRight, AlertCircle, Clock, Calendar } from "lucide-react";
import { EmployeeProfileDrawer, EmployeeData } from "./EmployeeProfileDrawer";
import { cn } from "@/lib/utils";

const MOCK_EMPLOYEES: EmployeeData[] = [
  {
    id: "00005",
    name: "Kocharin",
    nameEn: "Kocharin",
    initials: "KO",
    colorClass: "bg-emerald-500",
    title: "Vice President",
    department: "Procurement Department (BD)",
    station: "-",
    division: "Executive Office",
    section: "-",
    unit: "-",
    supervisor: "Nat Boonyavichkanont",
    status: "Active",
    empType: "Normal",
    contractStart: "01/01/2020",
    contractEnd: "-",
    probationEnd: "-",
    gender: "Male",
    nationality: "Thai",
    idCard: "1234567890123",
    email: "kocharin@example.com",
    phone: "0812345678",
    address: "Bangkok, Thailand",
    emergencyContact: "-",
    education: "-",
    workHistory: "-",
  },
  {
    id: "00008",
    name: "Nat Boonyavichkanont",
    nameEn: "Nat Boonyavichkanont",
    initials: "NB",
    colorClass: "bg-blue-500",
    title: "Chief Executive Officer",
    department: "HDQ(Exclusive)-สำนักงานใหญ่(พิเศษ)",
    station: "-",
    division: "Executive Office",
    section: "-",
    unit: "-",
    supervisor: "-",
    status: "Active",
    empType: "Normal",
    contractStart: "01/01/2018",
    contractEnd: "-",
    probationEnd: "-",
    gender: "Male",
    nationality: "Thai",
    idCard: "9876543210987",
    email: "nat.b@example.com",
    phone: "0898765432",
    address: "Bangkok, Thailand",
    emergencyContact: "-",
    education: "-",
    workHistory: "-",
  },
  {
    id: "00014",
    name: "Pattanit Thonsang-in",
    nameEn: "Pattanit Thonsang-in",
    initials: "PT",
    colorClass: "bg-pink-500",
    title: "Station Service Manager",
    department: "UTP-อู่ตะเภา",
    station: "UTP",
    division: "Ground Operation",
    section: "-",
    unit: "-",
    supervisor: "Nat Boonyavichkanont",
    status: "Active",
    empType: "Normal",
    contractStart: "15/03/2021",
    contractEnd: "-",
    probationEnd: "-",
    gender: "Female",
    nationality: "Thai",
    idCard: "1111222233334",
    email: "pattanit.t@example.com",
    phone: "0811122233",
    address: "Rayong, Thailand",
    emergencyContact: "-",
    education: "-",
    workHistory: "-",
  },
  {
    id: "00019",
    name: "Anupong Sirikhett",
    nameEn: "Anupong Sirikhett",
    initials: "AS",
    colorClass: "bg-emerald-500",
    title: "Load Control Supervisor",
    department: "UTP-อู่ตะเภา",
    station: "UTP",
    division: "Ground Operation",
    section: "-",
    unit: "-",
    supervisor: "Pattanit Thonsang-in",
    status: "Active",
    empType: "Normal",
    contractStart: "09/08/2021",
    contractEnd: "-",
    probationEnd: "-",
    gender: "Male",
    nationality: "Thai",
    idCard: "5555666677778",
    email: "anupong.s@example.com",
    phone: "0855566677",
    address: "Rayong, Thailand",
    emergencyContact: "-",
    education: "-",
    workHistory: "-",
  },
];

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
  const safeTh = (th || "").toString().trim();
  const safeEn = (en || "").toString().trim();
  
  if (safeTh && safeEn && safeTh !== "-" && safeEn !== "-" && safeTh.toLowerCase() !== safeEn.toLowerCase()) {
    return `${safeTh} / ${safeEn}`;
  }
  return safeTh || safeEn || fallback || "-";
};

interface EmployeeListProps {
  activeTab: "all" | "active" | "resigned" | "probation";
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
  onRefreshStateChange
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
    async function fetchEmployees() {
      const isManualRefresh = refreshKey > 0;
      if (isManualRefresh) {
        onRefreshStateChange?.(true);
      } else {
        setLoading(true);
      }

      try {
        const empRes = await fetch("/api/employees", { cache: "no-store" });

        if (!empRes.ok) {
          throw new Error("Failed to fetch from DynamoDB");
        }
        
        const data = await empRes.json();
        
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
            
            const empId = item.emp_code || item.staff_id || item.employeeId || item.id || "N/A";
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
              station: getDualLanguage(item.station_th, item.station_en, item.station),
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
              resignDate: item.resign_date || "-",
              probationOutcome: item.probation_outcome || "-",
              lastWorkingDate: item.last_working_date || "-",
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
          setEmployees(MOCK_EMPLOYEES);
        }
      } catch (error) {
        console.error("Using fallback mock data due to error:", error);
        setEmployees(MOCK_EMPLOYEES);
        setErrorMsg("ไม่สามารถเชื่อมต่อฐานข้อมูล Amazon ได้ กำลังแสดงข้อมูลจำลอง (Mock Data)");
      } finally {
        setLoading(false);
        if (isManualRefresh) onRefreshStateChange?.(false);
      }
    }

    fetchEmployees();
  }, [refreshKey, onRefreshStateChange]);

  // Reset pagination when activeTab, search query or filters change
  useEffect(() => {
    setVisibleCount(25);
  }, [activeTab, searchQuery, departmentFilter, divisionFilter, sectionFilter, stationFilter, unitFilter, startDateFilter, endDateFilter]);

  // Smart search and organization filtering
  const filteredEmployees = useMemo(() => {
    let result = employees;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter by activeTab first
    if (activeTab === "active") {
      result = result.filter(emp => emp.status && emp.status.toLowerCase() === "active");
      
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
      result = result.filter(emp => {
        const hasResignDate = (emp as any).resignDate && (emp as any).resignDate !== "-";
        const isFailedProbation = emp.status && emp.status.toLowerCase() === "failed probation";
        if (!hasResignDate && !isFailedProbation) return false;

        const status = (emp.status || "").toLowerCase();
        const isActive = status === "active" || status === "failed probation";
        
        const rDate = new Date((emp as any).resignDate);
        const isFutureOrToday = !isNaN(rDate.getTime()) && (() => {
          rDate.setHours(0, 0, 0, 0);
          return rDate.getTime() >= today.getTime();
        })();

        // Show if:
        // 1. They are currently "Active" or "Failed Probation" and have a resignation date.
        // 2. OR their resignation date is in the future (regardless of status).
        return isActive || isFutureOrToday;
      });

      // Calculate days remaining until resignation and store on the employee object
      result = result.map(emp => {
        const rDate = new Date((emp as any).resignDate);
        if (!isNaN(rDate.getTime())) {
          rDate.setHours(0, 0, 0, 0);
          const diffTime = rDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          (emp as any).resignDiffDays = diffDays;
        }
        return emp;
      });

      // Sort by resignation date ascending (closest to furthest)
      result = [...result].sort((a, b) => {
        const aDays = (a as any).resignDiffDays ?? 999999;
        const bDays = (b as any).resignDiffDays ?? 999999;
        return aDays - bDays;
      });
    } else if (activeTab === "probation") {
      // Must be active, in probation, and NOT resigned or scheduled to resign
      result = result.filter(emp => 
        emp.status && emp.status.toLowerCase() === "active" &&
        !emp.status.toLowerCase().includes("resign") &&
        (!emp.resignDate || emp.resignDate === "-") &&
        emp.empType && emp.empType.toLowerCase() === "probation" &&
        emp.probationEnd && emp.probationEnd !== "-"
      );

      // Calculate days remaining for all active probation employees
      result = result.filter(emp => {
        const pDate = new Date(emp.probationEnd);
        if (isNaN(pDate.getTime())) return false;
        pDate.setHours(0, 0, 0, 0);
        const diffTime = pDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        (emp as any).diffDays = diffDays;
        return true; // Show all active probation staff sorted by urgency
      });

      // Sort by remaining days ascending (least to most)
      result = [...result].sort((a, b) => {
        const aDays = (a as any).diffDays ?? 999999;
        const bDays = (b as any).diffDays ?? 999999;
        return aDays - bDays;
      });
    }

    // Apply organization filters
    if (departmentFilter && departmentFilter !== "-") {
      result = result.filter(emp => emp.department && emp.department.includes(departmentFilter.split(' (')[0]));
    }
    if (divisionFilter && divisionFilter !== "-") {
      result = result.filter(emp => emp.division && emp.division.includes(divisionFilter.split(' (')[0]));
    }
    if (sectionFilter && sectionFilter !== "-") {
      result = result.filter(emp => emp.section && emp.section.includes(sectionFilter.split(' (')[0]));
    }
    if (stationFilter && stationFilter !== "-") {
      result = result.filter(emp => emp.station === stationFilter);
    }
    if (unitFilter && unitFilter !== "-") {
      result = result.filter(emp => emp.unit && emp.unit.includes(unitFilter.split(' (')[0]));
    }

    // Apply date range filter (start_date / contractStart)
    if (startDateFilter || endDateFilter) {
      const parseDate = (dateStr: string): Date | null => {
        if (!dateStr || dateStr === "-") return null;
        
        // Try YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) return d;
        }
        
        // Try DD/MM/YYYY
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
          const parts = dateStr.split("/");
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // 0-indexed
          const year = parseInt(parts[2], 10);
          const d = new Date(year, month, day);
          if (!isNaN(d.getTime())) return d;
        }
        
        const fallbackDate = new Date(dateStr);
        if (!isNaN(fallbackDate.getTime())) return fallbackDate;
        
        return null;
      };

      const start = startDateFilter ? new Date(startDateFilter) : null;
      if (start) start.setHours(0, 0, 0, 0);
      
      const end = endDateFilter ? new Date(endDateFilter) : null;
      if (end) end.setHours(23, 59, 59, 999);

      result = result.filter(emp => {
        const dateStr = activeTab === "resigned" ? (emp as any).resignDate : emp.contractStart;
        if (!dateStr || dateStr === "-") return false;
        
        const targetDate = parseDate(dateStr);
        if (!targetDate) return false;
        
        targetDate.setHours(0, 0, 0, 0);

        if (start && targetDate.getTime() < start.getTime()) return false;
        if (end && targetDate.getTime() > end.getTime()) return false;
        
        return true;
      });
    }

    const query = searchQuery.trim().replace(/^@/, "");
    if (!query) return result;
    
    const isNumeric = /^\d+$/.test(query);
    
    return result.filter(emp => {
      if (isNumeric) {
        if (query.length <= 5) {
          // 1-5 digits: Search by ID
          return emp.id.includes(query);
        } else if (query.length <= 10) {
          // 6-10 digits: Search by Phone
          return emp.phone.includes(query);
        } else {
          // 11+ digits: Search by ID Card
          return emp.idCard.includes(query);
        }
      } else {
        // Not purely numeric: Search by Name (Thai/English)
        const lowerQuery = query.toLowerCase();
        return (
          (emp.name && emp.name.toLowerCase().includes(lowerQuery)) || 
          (emp.nameEn && emp.nameEn.toLowerCase().includes(lowerQuery))
        );
      }
    });
  }, [employees, activeTab, searchQuery, departmentFilter, divisionFilter, sectionFilter, stationFilter, unitFilter, startDateFilter, endDateFilter]);

  if (loading) {
    return (
      <div className="w-full py-12 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-white"></div>
        <span className="ml-3 text-slate-500 dark:text-slate-400">Loading employees from DynamoDB...</span>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      {errorMsg && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex items-center justify-between">
          <p className="text-sm text-amber-700 dark:text-amber-400">{errorMsg}</p>
        </div>
      )}

      <div className="min-w-0 space-y-3 sm:space-y-4">
        {!selectedEmployee && filteredEmployees.slice(0, visibleCount).map((emp, idx) => (
          <div
            key={emp.id}
            onClick={() => openEmployee(emp)}
            className="group flex min-w-0 items-center justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition-all duration-300 hover:shadow-md dark:border-white/5 dark:bg-[#121212] sm:p-4"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <div className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-100 bg-slate-100 text-base font-bold text-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900 sm:h-12 sm:w-12 sm:text-lg", emp.colorClass)}>
                {emp.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-sky-700 dark:text-sky-300 leading-tight truncate">ID: {emp.id}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate">{emp.nameEn !== "-" ? emp.nameEn : emp.name}</h3>
                </div>
                {emp.nameEn !== "-" && <p className="text-sm text-slate-600 dark:text-slate-400 font-normal truncate">{emp.name}</p>}
              </div>

              {activeTab === "all" && (
                <div className="hidden sm:flex items-center justify-center shrink-0 w-24 md:w-28 mr-2 md:mr-4">
                  <span className={cn(
                    "inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all",
                    emp.status && emp.status.toLowerCase() === "active"
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20"
                      : emp.status && emp.status.toLowerCase().includes("resign")
                        ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20"
                        : "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-white/10"
                  )}>
                    {emp.status || "Unknown"}
                  </span>
                </div>
              )}
              
              {/* Probation Countdown Alert Badge */}
              {(activeTab === "probation" || activeTab === "active") && (emp as any).diffDays !== undefined && (
                <div className="flex items-center shrink-0 mr-2 md:mr-4">
                  {(() => {
                    const days = (emp as any).diffDays;
                    if (days < 0) {
                      return (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 rounded-full text-xs font-semibold transition-colors">
                          <AlertCircle className="w-3.5 h-3.5 animate-bounce shrink-0" />
                          <span>เลยกำหนด {Math.abs(days)} วัน</span>
                        </div>
                      );
                    } else if (days === 0) {
                      return (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 rounded-full text-xs font-semibold transition-colors animate-pulse">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>ครบกำหนดวันนี้</span>
                        </div>
                      );
                    } else if (days <= 30) {
                      return (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-500/20 rounded-full text-xs font-semibold transition-colors">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>เหลืออีก {days} วัน (วิกฤต)</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 rounded-full text-xs font-semibold transition-colors">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>เหลืออีก {days} วัน</span>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}

              {/* Resignation Countdown Alert Badge */}
              {activeTab === "resigned" && (emp as any).resignDiffDays !== undefined && (
                <div className="flex items-center shrink-0 mr-2 md:mr-4">
                  {(() => {
                    const days = (emp as any).resignDiffDays;
                    const rDateStr = (emp as any).resignDate;
                    
                    // Format date to local Thai format (e.g. 16 มิ.ย. 2569 or 16/06/2026)
                    let formattedDate = rDateStr;
                    try {
                      const d = new Date(rDateStr);
                      if (!isNaN(d.getTime())) {
                        formattedDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
                      }
                    } catch (e) {}

                    const isFailedProb = emp.status && emp.status.toLowerCase() === "failed probation";
                    if (isFailedProb) {
                      return (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 rounded-full text-xs font-semibold transition-colors">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>ไม่ผ่านทดลองงาน ({formattedDate})</span>
                        </div>
                      );
                    }

                    if (days < 0) {
                      return (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 rounded-full text-xs font-semibold transition-colors">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                          <span>เลยกำหนดวันลาออก {Math.abs(days)} วัน ({formattedDate})</span>
                        </div>
                      );
                    } else if (days === 0) {
                      return (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 rounded-full text-xs font-semibold transition-colors animate-pulse">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>ลาออกวันนี้ ({formattedDate})</span>
                        </div>
                      );
                    } else if (days <= 30) {
                      return (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-500/20 rounded-full text-xs font-semibold transition-colors">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>ลาออกใน {days} วัน ({formattedDate})</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 rounded-full text-xs font-semibold transition-colors">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>ลาออกใน {days} วัน ({formattedDate})</span>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}

              <div className="hidden md:flex flex-1 items-center gap-2 text-slate-500 dark:text-slate-400 min-w-0">
                <Briefcase className="w-4 h-4 opacity-50 shrink-0" />
                <span className="text-sm truncate">{emp.title}</span>
              </div>
              <div className="hidden lg:flex flex-1 items-center justify-end pr-8 min-w-0">
                <span className="px-3 py-1 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-full text-xs text-slate-500 dark:text-slate-400 truncate max-w-full">
                  {emp.department}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-900 dark:text-slate-600 dark:group-hover:text-slate-300">
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>
      
      {!selectedEmployee && visibleCount < filteredEmployees.length && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setVisibleCount(prev => prev + 25)}
            className="px-6 py-2.5 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-full text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
          >
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
