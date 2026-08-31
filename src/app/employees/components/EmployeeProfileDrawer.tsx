"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Edit2, MapPin, Briefcase, Calendar, User, Save, Loader2, Check, Award, Copy, FileText, Upload, Trash2, Clock, Link, Eye, Download, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { PassProbationModal } from "./PassProbationModal";

const MAX_DOCUMENT_FILE_SIZE_MB = 25;
const MAX_DOCUMENT_FILE_SIZE_BYTES = MAX_DOCUMENT_FILE_SIZE_MB * 1024 * 1024;

type EmployeeDocumentFile = {
  name: string;
  data: string;
  uploadedAt?: string;
};

export interface EmployeeData {
  id: string;
  name: string;
  nameEn: string;
  initials: string;
  colorClass: string;
  title: string;
  department: string;
  station: string;
  division: string;
  section: string;
  unit: string;
  supervisor: string;
  status: string;
  empType: string;
  contractStart: string;
  contractEnd: string;
  probationEnd: string;
  probationDays?: string | number;
  resignDate?: string;
  gender: string;
  nationality: string;
  idCard: string;
  birthDate?: string;
  age?: string | number;
  retirementYear?: number;
  retirementAge?: number;
  turnsSixtyThisYear?: boolean;
  email: string;
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;
  education: string;
  workHistory: string;
  lineAvatarUrl?: string;
  bankAccount?: string;
  nickname?: string;
  lineUserId?: string;
  attachmentName?: string;
  attachmentData?: string;
  resumeDocumentName?: string;
  resumeDocumentData?: string;
  resumeDocumentFiles?: EmployeeDocumentFile[];
  idCardCopyDocumentName?: string;
  idCardCopyDocumentData?: string;
  idCardCopyDocumentFiles?: EmployeeDocumentFile[];
  houseRegistrationDocumentName?: string;
  houseRegistrationDocumentData?: string;
  houseRegistrationDocumentFiles?: EmployeeDocumentFile[];
  educationCertificateDocumentName?: string;
  educationCertificateDocumentData?: string;
  educationCertificateDocumentFiles?: EmployeeDocumentFile[];
  criminalRecordCheckDocumentName?: string;
  criminalRecordCheckDocumentData?: string;
  criminalRecordCheckDocumentFiles?: EmployeeDocumentFile[];
  medicalCheckDocumentName?: string;
  medicalCheckDocumentData?: string;
  medicalCheckDocumentFiles?: EmployeeDocumentFile[];
  militaryDocumentName?: string;
  militaryDocumentData?: string;
  militaryDocumentFiles?: EmployeeDocumentFile[];
  nameChangeDocumentName?: string;
  nameChangeDocumentData?: string;
  nameChangeDocumentFiles?: EmployeeDocumentFile[];
  employmentCertificateDocumentName?: string;
  employmentCertificateDocumentData?: string;
  employmentCertificateDocumentFiles?: EmployeeDocumentFile[];
  toeicScoreDocumentName?: string;
  toeicScoreDocumentData?: string;
  toeicScoreDocumentFiles?: EmployeeDocumentFile[];
  driverLicenseDocumentName?: string;
  driverLicenseDocumentData?: string;
  driverLicenseDocumentFiles?: EmployeeDocumentFile[];
  bankBookDocumentName?: string;
  bankBookDocumentData?: string;
  bankBookDocumentFiles?: EmployeeDocumentFile[];
  pending_adjustment?: {
    department: string;
    division: string;
    section: string;
    unit: string;
    position: string;
    effectiveDate: string;
    type?: string;
  };
  titlePrefix?: string;
  firstNameTh?: string;
  lastNameTh?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  probationPassOperatorId?: string;
  probationPassOperatorName?: string;
  probationPassOperatorPosition?: string;
  probationPassDate?: string;
  probationPassAttachmentName?: string;
  probationPassAttachmentData?: string;
  probationPassAttachmentFiles?: EmployeeDocumentFile[];
  probationOutcome?: string;
  lastWorkingDate?: string;
  probationExtensionDays?: number;
  databaseDetails?: Array<{ label: string; value: string }>;
}

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeData | null;
  onUpdate?: (data: EmployeeData) => void;
  blurBackground?: boolean;
}

type EmployeeDocumentItem = {
  id: string;
  label: string;
  name?: string;
  data?: string;
};

type EmployeeProfileTab = "personal" | "documents" | "system";

type ConfirmationDialog = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};


type EmployeeDocumentConfig = {
  id: string;
  label: string;
  nameField: keyof EmployeeData;
  dataField: keyof EmployeeData;
  filesField: keyof EmployeeData;
};

const EMPLOYEE_DOCUMENT_FIELDS: EmployeeDocumentConfig[] = [
  { id: "resumeDocument", label: "ประวัติส่วนบุคคล (Resume)", nameField: "resumeDocumentName", dataField: "resumeDocumentData" , filesField: "resumeDocumentFiles" },
  { id: "idCardCopyDocument", label: "สำเนาบัตรประจำตัวประชาชน", nameField: "idCardCopyDocumentName", dataField: "idCardCopyDocumentData" , filesField: "idCardCopyDocumentFiles" },
  { id: "houseRegistrationDocument", label: "สำเนาทะเบียนบ้าน", nameField: "houseRegistrationDocumentName", dataField: "houseRegistrationDocumentData" , filesField: "houseRegistrationDocumentFiles" },
  { id: "educationCertificateDocument", label: "สำเนาหลักฐานการศึกษา", nameField: "educationCertificateDocumentName", dataField: "educationCertificateDocumentData" , filesField: "educationCertificateDocumentFiles" },
  { id: "criminalRecordCheckDocument", label: "หลักฐานการตรวจประวัติอาญากรรม", nameField: "criminalRecordCheckDocumentName", dataField: "criminalRecordCheckDocumentData" , filesField: "criminalRecordCheckDocumentFiles" },
  { id: "medicalCheckDocument", label: "ผลตรวจร่างกายก่อนเริ่มงาน", nameField: "medicalCheckDocumentName", dataField: "medicalCheckDocumentData" , filesField: "medicalCheckDocumentFiles" },
  { id: "militaryDocument", label: "หลักฐานการผ่านทหาร /เอกสารได้รับการยกเว้นการเกณฑ์ทหาร", nameField: "militaryDocumentName", dataField: "militaryDocumentData" , filesField: "militaryDocumentFiles" },
  { id: "nameChangeDocument", label: "สำเนาหลักฐานการเปลี่ยนชื่อ-สกุล", nameField: "nameChangeDocumentName", dataField: "nameChangeDocumentData" , filesField: "nameChangeDocumentFiles" },
  { id: "employmentCertificateDocument", label: "สำเนาหลักฐานรับรองการผ่านงาน", nameField: "employmentCertificateDocumentName", dataField: "employmentCertificateDocumentData" , filesField: "employmentCertificateDocumentFiles" },
  { id: "toeicScoreDocument", label: "สำเนาผลคะแนนการสอบ TOEIC", nameField: "toeicScoreDocumentName", dataField: "toeicScoreDocumentData" , filesField: "toeicScoreDocumentFiles" },
  { id: "driverLicenseDocument", label: "สำเนาใบขับขี่รถยนต์ส่วนบุคคล", nameField: "driverLicenseDocumentName", dataField: "driverLicenseDocumentData" , filesField: "driverLicenseDocumentFiles" },
  { id: "bankBookDocument", label: "สำเนาสมุดบัญชีเงินฝาก", nameField: "bankBookDocumentName", dataField: "bankBookDocumentData" , filesField: "bankBookDocumentFiles" },
  { id: "probationPassAttachment", label: "เอกสารประเมินผลทดลองงาน", nameField: "probationPassAttachmentName", dataField: "probationPassAttachmentData" , filesField: "probationPassAttachmentFiles" },
];


const EMPLOYEE_PROFILE_TABS: Array<{ id: EmployeeProfileTab; label: string }> = [
  { id: "personal", label: "Personal Information" },
  { id: "documents", label: "Documents" },
  { id: "system", label: "\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e23\u0e30\u0e1a\u0e1a" },
];

type ServerEmployeeRecord = Record<string, unknown>;

const getDualLanguageValue = (th: unknown, en: unknown, fallback: unknown) => {
  const safeTh = (th || "").toString().trim();
  const safeEn = (en || "").toString().trim();
  const safeFallback = (fallback || "").toString().trim();

  if (safeTh && safeEn && safeTh !== "-" && safeEn !== "-" && safeTh.toLowerCase() !== safeEn.toLowerCase()) {
    return `${safeTh} / ${safeEn}`;
  }

  return safeTh || safeEn || safeFallback || "-";
};


const DATABASE_DETAIL_FIELDS: Array<{ label: string; keys: string[] }> = [
  { label: "Payment Type", keys: ["payment_type"] },
  { label: "Schedule Type", keys: ["schedule_type"] },
  { label: "Service Years", keys: ["service_years"] },
  { label: "Service Months", keys: ["service_months"] },
  { label: "Service Days", keys: ["service_days", "total_service_days"] },
  { label: "Total Service Years", keys: ["total_service_years"] },
  { label: "Job Grade", keys: ["grade", "job_grade_level"] },
  { label: "User Type", keys: ["user_type"] },
  { label: "Approval Code", keys: ["apv_code"] },
  { label: "Religion", keys: ["religion"] },
  { label: "Bank Name", keys: ["bank_name"] },
  { label: "Bank Branch", keys: ["bank_branch"] },
  { label: "Resign Type", keys: ["resign_type"] },
  { label: "Resign Status", keys: ["resign_status"] },
  { label: "Resign Request ID", keys: ["resign_request_id"] },
  { label: "Separation Type", keys: ["separation_type"] },
  { label: "Separation Date", keys: ["separation_date"] },
  { label: "Last Work Date", keys: ["last_work_date"] },
  { label: "Verify Submitted At", keys: ["verify_submitted_at"] },
  { label: "Verify Acknowledged At", keys: ["verify_acknowledged_at"] },
  { label: "Verify Acknowledged By", keys: ["verify_acknowledged_by"] },
  { label: "Verify Edit Reason", keys: ["verify_edit_reason"] },
  { label: "Created At", keys: ["created_at"] },
  { label: "Created By", keys: ["created_by"] },
  { label: "Restored At", keys: ["restored_at"] },
  { label: "Restored By", keys: ["restored_by"] },
  { label: "Last Updated", keys: ["updated_at"] },
  { label: "Updated By", keys: ["updated_by"] },
];

const isFilledDatabaseValue = (value: unknown) => {
  if (value === undefined || value === null) return false;
  const text = String(value).trim();
  return text !== "" && text !== "-" && text.toLowerCase() !== "null" && text.toLowerCase() !== "undefined";
};

const formatDatabaseValue = (value: unknown) => {
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value).trim();
};

const composeAddressFromDatabaseFields = (record: ServerEmployeeRecord) => {
  const get = (key: string) => {
    const value = record[key];
    return isFilledDatabaseValue(value) ? String(value).trim() : "";
  };

  const parts = [
    get("house_no"),
    get("moo") ? "\u0e2b\u0e21\u0e39\u0e48 " + get("moo") : "",
    get("village"),
    get("soi") ? "\u0e0b. " + get("soi") : "",
    get("road") ? "\u0e16. " + get("road") : "",
    get("sub_district") ? "\u0e15. " + get("sub_district") : "",
    get("district") ? "\u0e2d. " + get("district") : "",
    get("province") ? "\u0e08. " + get("province") : "",
    get("zip_code"),
  ].filter(Boolean);

  return parts.join(" ");
};
export function EmployeeProfileDrawer({ isOpen, onClose, employee, onUpdate, blurBackground = false }: DrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<EmployeeData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPassProbationOpen, setIsPassProbationOpen] = useState(false);
  const [isDocumentsSheetOpen, setIsDocumentsSheetOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<EmployeeProfileTab>("personal");
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialog | null>(null);
  const confirmationResolverRef = useRef<((value: boolean) => void) | null>(null);

  const mergeServerEmployee = (fallback: EmployeeData, updatedItem?: ServerEmployeeRecord): EmployeeData => {
    if (!updatedItem) return fallback;
    const field = <T,>(key: string, fallbackValue: T): T => {
      const value = updatedItem[key];
      return (value === undefined || value === null ? fallbackValue : value) as T;
    };

    const firstFilledField = <T,>(keys: string[], fallbackValue: T): T => {
      for (const key of keys) {
        const value = updatedItem[key];
        if (value === undefined || value === null) continue;
        const text = String(value).trim();
        if (text && text !== "-" && text.toLowerCase() !== "null" && text.toLowerCase() !== "undefined") {
          return value as T;
        }
      }
      return fallbackValue;
    };

    const databaseDetails = DATABASE_DETAIL_FIELDS.flatMap(({ label, keys }) => {
      const value = keys.map((key) => updatedItem[key]).find(isFilledDatabaseValue);
      return value === undefined ? [] : [{ label, value: formatDatabaseValue(value) }];
    });
    const composedAddress = composeAddressFromDatabaseFields(updatedItem);
    const titleTh = updatedItem.title_th;
    const titleEn = updatedItem.title_en;
    const titlePrefix = isFilledDatabaseValue(titleTh) && isFilledDatabaseValue(titleEn)
      ? String(titleTh).trim() + " / " + String(titleEn).trim()
      : isFilledDatabaseValue(titleTh)
        ? String(titleTh).trim()
        : isFilledDatabaseValue(titleEn)
          ? String(titleEn).trim()
          : fallback.titlePrefix;

    return {
      ...fallback,
      id: field("staff_id", fallback.id),
      name: field("name_th", field("name", fallback.name)),
      nameEn: field("name_en", fallback.nameEn),
      titlePrefix,
      title: getDualLanguageValue(updatedItem.position_th, updatedItem.position_en, field("position", fallback.title)),
      department: getDualLanguageValue(updatedItem.department_th, updatedItem.department_en, field("department", fallback.department)),
      division: getDualLanguageValue(updatedItem.division_th, updatedItem.division_en, field("division", fallback.division)),
      section: getDualLanguageValue(updatedItem.section_th, updatedItem.section_en, field("section", fallback.section)),
      unit: getDualLanguageValue(updatedItem.unit_th, updatedItem.unit_en, field("unit", fallback.unit)),
      station: getDualLanguageValue(updatedItem.station_th, updatedItem.station_en, field("station", fallback.station)),
      supervisor: field("supervisor", fallback.supervisor),
      status: field("status", fallback.status),
      empType: field("emp_type", fallback.empType),
      contractStart: field("start_date", fallback.contractStart),
      contractEnd: field("contract_end", fallback.contractEnd),
      probationEnd: field("probation_end_date", field("probation_end", fallback.probationEnd)),
      probationDays: field("probation_days", field("probation_day", field("probation_period_days", field("probation_duration_days", field("probation_total_days", field("prob_days", field("prob_period", fallback.probationDays))))))),
      gender: field("gender", fallback.gender),
      nationality: field("nationality", fallback.nationality),
      idCard: field("id_card", fallback.idCard),
      birthDate: field("birth_date", fallback.birthDate),
      age: field("age", fallback.age),
      email: field("email", fallback.email),
      phone: field("phone", fallback.phone),
      address: firstFilledField(["address"], composedAddress || fallback.address),
      emergencyContact: firstFilledField(["emergency_contact"], fallback.emergencyContact),
      emergencyContactName: firstFilledField(["emergency_contact_name", "emergency_name", "contact_person"], fallback.emergencyContactName),
      emergencyContactRelation: firstFilledField(["emergency_contact_relation", "emergency_relation", "contact_relation"], fallback.emergencyContactRelation),
      emergencyContactPhone: firstFilledField(["emergency_contact_phone", "emergency_phone", "contact_phone"], fallback.emergencyContactPhone),
      probationOutcome: field("probation_outcome", fallback.probationOutcome),
      lastWorkingDate: field("last_working_date", fallback.lastWorkingDate),
      probationExtensionDays: field("probation_extension_days", fallback.probationExtensionDays),
      probationPassOperatorId: field("probation_pass_operator_id", fallback.probationPassOperatorId),
      probationPassOperatorName: field("probation_pass_operator_name", fallback.probationPassOperatorName),
      probationPassOperatorPosition: field("probation_pass_operator_position", fallback.probationPassOperatorPosition),
      probationPassDate: field("probation_pass_date", fallback.probationPassDate),
      probationPassAttachmentName: field("probation_pass_attachment_name", fallback.probationPassAttachmentName),
      probationPassAttachmentData: field("probation_pass_attachment_data", fallback.probationPassAttachmentData),
      probationPassAttachmentFiles: field("probation_pass_attachment_files", fallback.probationPassAttachmentFiles),
      bankAccount: field("bank_account_no", field("bank_account", fallback.bankAccount)),
      nickname: field("nickname", fallback.nickname),
      attachmentName: field("attachment_name", fallback.attachmentName),
      attachmentData: field("attachment_data", fallback.attachmentData),
      resumeDocumentName: field("resume_document_name", fallback.resumeDocumentName),
      resumeDocumentData: field("resume_document_data", fallback.resumeDocumentData),
      resumeDocumentFiles: field("resume_document_files", fallback.resumeDocumentFiles),
      idCardCopyDocumentName: field("id_card_copy_document_name", fallback.idCardCopyDocumentName),
      idCardCopyDocumentData: field("id_card_copy_document_data", fallback.idCardCopyDocumentData),
      idCardCopyDocumentFiles: field("id_card_copy_document_files", fallback.idCardCopyDocumentFiles),
      houseRegistrationDocumentName: field("house_registration_document_name", fallback.houseRegistrationDocumentName),
      houseRegistrationDocumentData: field("house_registration_document_data", fallback.houseRegistrationDocumentData),
      houseRegistrationDocumentFiles: field("house_registration_document_files", fallback.houseRegistrationDocumentFiles),
      educationCertificateDocumentName: field("education_certificate_document_name", fallback.educationCertificateDocumentName),
      educationCertificateDocumentData: field("education_certificate_document_data", fallback.educationCertificateDocumentData),
      educationCertificateDocumentFiles: field("education_certificate_document_files", fallback.educationCertificateDocumentFiles),
      criminalRecordCheckDocumentName: field("criminal_record_check_document_name", fallback.criminalRecordCheckDocumentName),
      criminalRecordCheckDocumentData: field("criminal_record_check_document_data", fallback.criminalRecordCheckDocumentData),
      criminalRecordCheckDocumentFiles: field("criminal_record_check_document_files", fallback.criminalRecordCheckDocumentFiles),
      medicalCheckDocumentName: field("medical_check_document_name", fallback.medicalCheckDocumentName),
      medicalCheckDocumentData: field("medical_check_document_data", fallback.medicalCheckDocumentData),
      medicalCheckDocumentFiles: field("medical_check_document_files", fallback.medicalCheckDocumentFiles),
      militaryDocumentName: field("military_document_name", fallback.militaryDocumentName),
      militaryDocumentData: field("military_document_data", fallback.militaryDocumentData),
      militaryDocumentFiles: field("military_document_files", fallback.militaryDocumentFiles),
      nameChangeDocumentName: field("name_change_document_name", fallback.nameChangeDocumentName),
      nameChangeDocumentData: field("name_change_document_data", fallback.nameChangeDocumentData),
      nameChangeDocumentFiles: field("name_change_document_files", fallback.nameChangeDocumentFiles),
      employmentCertificateDocumentName: field("employment_certificate_document_name", fallback.employmentCertificateDocumentName),
      employmentCertificateDocumentData: field("employment_certificate_document_data", fallback.employmentCertificateDocumentData),
      employmentCertificateDocumentFiles: field("employment_certificate_document_files", fallback.employmentCertificateDocumentFiles),
      toeicScoreDocumentName: field("toeic_score_document_name", fallback.toeicScoreDocumentName),
      toeicScoreDocumentData: field("toeic_score_document_data", fallback.toeicScoreDocumentData),
      toeicScoreDocumentFiles: field("toeic_score_document_files", fallback.toeicScoreDocumentFiles),
      driverLicenseDocumentName: field("driver_license_document_name", fallback.driverLicenseDocumentName),
      driverLicenseDocumentData: field("driver_license_document_data", fallback.driverLicenseDocumentData),
      driverLicenseDocumentFiles: field("driver_license_document_files", fallback.driverLicenseDocumentFiles),
      bankBookDocumentName: field("bank_book_document_name", fallback.bankBookDocumentName),
      bankBookDocumentData: field("bank_book_document_data", fallback.bankBookDocumentData),
      bankBookDocumentFiles: field("bank_book_document_files", fallback.bankBookDocumentFiles),
      lineUserId: field("line_user_id", fallback.lineUserId),
      lineAvatarUrl: field("line_avatar_url", fallback.lineAvatarUrl),
      databaseDetails,
    };
  };
  const [orgData, setOrgData] = useState<any[]>([]);
  const [hydratedEmployee, setHydratedEmployee] = useState<EmployeeData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isRefreshingDetails, setIsRefreshingDetails] = useState(false);

  useEffect(() => {
    if (!isOpen || !employee?.id) {
      setHydratedEmployee(null);
      setIsLoadingDetails(false);
      return;
    }

    let cancelled = false;
    setHydratedEmployee(null);
    setIsLoadingDetails(true);

    fetch(`/api/employees?id=${encodeURIComponent(employee.id)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load employee detail: ${res.status}`);
        return res.json();
      })
      .then((item) => {
        if (!cancelled) {
          setHydratedEmployee(mergeServerEmployee(employee, item));
        }
      })
      .catch((err) => {
        if (!cancelled) console.error("Error loading employee detail", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, employee?.id]);

  // Fetch org data only when an org-editing flow needs it. Loading this on
  // every profile open makes the read-only drawer feel slower than it should.
  useEffect(() => {
    if (isOpen && orgData.length === 0 && isEditing) {
      fetch("/api/organization")
        .then(res => res.json())
        .then(data => setOrgData(data))
        .catch(err => console.error("Error fetching org data", err));
    }
  }, [isOpen, isEditing, orgData.length]);

  // Profile photos are intentionally not displayed or auto-synced here;
  // employee avatars use English initials for a consistent HR directory view.

  // Org data is fetched above

  useEffect(() => {
    const profileEmployee = hydratedEmployee || employee;
    if (isOpen && profileEmployee) {
      let titlePrefix = "นาย / Mr.";
      let cleanRawName = profileEmployee.name && profileEmployee.name !== "-" && profileEmployee.name !== "undefined" && profileEmployee.name !== "null" ? profileEmployee.name : "";
      let cleanRawNameEn = profileEmployee.nameEn && profileEmployee.nameEn !== "-" && profileEmployee.nameEn !== "undefined" && profileEmployee.nameEn !== "null" ? profileEmployee.nameEn : "";

      let firstNameTh = cleanRawName;
      let lastNameTh = "";
      let firstNameEn = cleanRawNameEn;
      let lastNameEn = "";

      if (cleanRawName) {
        // Sanitize leading dots, spaces, and hyphens
        let n = String(cleanRawName).replace(/^[\.\s\-]+/, "");
        
        if (n.startsWith("นาย ")) { titlePrefix = "นาย / Mr."; n = n.substring(4); }
        else if (n.startsWith("นาย")) { titlePrefix = "นาย / Mr."; n = n.substring(3); }
        else if (n.startsWith("นางสาว ")) { titlePrefix = "นางสาว / Miss"; n = n.substring(7); }
        else if (n.startsWith("นางสาว")) { titlePrefix = "นางสาว / Miss"; n = n.substring(6); }
        else if (n.startsWith("นาง ")) { titlePrefix = "นาง / Mrs."; n = n.substring(4); }
        else if (n.startsWith("นาง")) { titlePrefix = "นาง / Mrs."; n = n.substring(3); }
        
        n = n.trim();
        if (n) {
          const parts = n.split(/\s+/);
          firstNameTh = parts[0];
          lastNameTh = parts.slice(1).join(" ");
        }
      }

      if (cleanRawNameEn) {
        // Sanitize leading dots, spaces, and hyphens
        let n = String(cleanRawNameEn).replace(/^[\.\s\-]+/, "");
        
        if (n.startsWith("Mr. ")) { titlePrefix = "นาย / Mr."; n = n.substring(4); }
        else if (n.startsWith("Mr ")) { titlePrefix = "นาย / Mr."; n = n.substring(3); }
        else if (n.startsWith("Miss ")) { titlePrefix = "นางสาว / Miss"; n = n.substring(5); }
        else if (n.startsWith("Mrs. ")) { titlePrefix = "นาง / Mrs."; n = n.substring(5); }
        else if (n.startsWith("Mrs ")) { titlePrefix = "นาง / Mrs."; n = n.substring(4); }
        else if (n.startsWith("Ms. ")) { titlePrefix = "นางสาว / Miss"; n = n.substring(4); }
        else if (n.startsWith("Ms ")) { titlePrefix = "นางสาว / Miss"; n = n.substring(3); }
        
        n = n.trim();
        if (n) {
          const parts = n.split(/\s+/);
          firstNameEn = parts[0];
          lastNameEn = parts.slice(1).join(" ");
        }
      }

      setEditedData({ 
        ...profileEmployee,
        titlePrefix,
        firstNameTh,
        lastNameTh,
        firstNameEn,
        lastNameEn,
        emergencyContactName: profileEmployee.emergencyContactName || "",
        emergencyContactRelation: profileEmployee.emergencyContactRelation || "",
        emergencyContactPhone: profileEmployee.emergencyContactPhone || "",
        bankAccount: profileEmployee.bankAccount || "",
        nickname: profileEmployee.nickname || "",
        birthDate: profileEmployee.birthDate || "",
        age: profileEmployee.age || "",
        lineUserId: profileEmployee.lineUserId || "",
        lineAvatarUrl: profileEmployee.lineAvatarUrl || "",
        attachmentName: profileEmployee.attachmentName || "",
        attachmentData: profileEmployee.attachmentData || "",
        resumeDocumentName: profileEmployee.resumeDocumentName || "",
        resumeDocumentData: profileEmployee.resumeDocumentData || "",
        resumeDocumentFiles: profileEmployee.resumeDocumentFiles || [],
        idCardCopyDocumentName: profileEmployee.idCardCopyDocumentName || "",
        idCardCopyDocumentData: profileEmployee.idCardCopyDocumentData || "",
        idCardCopyDocumentFiles: profileEmployee.idCardCopyDocumentFiles || [],
        houseRegistrationDocumentName: profileEmployee.houseRegistrationDocumentName || "",
        houseRegistrationDocumentData: profileEmployee.houseRegistrationDocumentData || "",
        houseRegistrationDocumentFiles: profileEmployee.houseRegistrationDocumentFiles || [],
        educationCertificateDocumentName: profileEmployee.educationCertificateDocumentName || "",
        educationCertificateDocumentData: profileEmployee.educationCertificateDocumentData || "",
        educationCertificateDocumentFiles: profileEmployee.educationCertificateDocumentFiles || [],
        criminalRecordCheckDocumentName: profileEmployee.criminalRecordCheckDocumentName || "",
        criminalRecordCheckDocumentData: profileEmployee.criminalRecordCheckDocumentData || "",
        criminalRecordCheckDocumentFiles: profileEmployee.criminalRecordCheckDocumentFiles || [],
        medicalCheckDocumentName: profileEmployee.medicalCheckDocumentName || "",
        medicalCheckDocumentData: profileEmployee.medicalCheckDocumentData || "",
        medicalCheckDocumentFiles: profileEmployee.medicalCheckDocumentFiles || [],
        militaryDocumentName: profileEmployee.militaryDocumentName || "",
        militaryDocumentData: profileEmployee.militaryDocumentData || "",
        militaryDocumentFiles: profileEmployee.militaryDocumentFiles || [],
        nameChangeDocumentName: profileEmployee.nameChangeDocumentName || "",
        nameChangeDocumentData: profileEmployee.nameChangeDocumentData || "",
        nameChangeDocumentFiles: profileEmployee.nameChangeDocumentFiles || [],
        employmentCertificateDocumentName: profileEmployee.employmentCertificateDocumentName || "",
        employmentCertificateDocumentData: profileEmployee.employmentCertificateDocumentData || "",
        employmentCertificateDocumentFiles: profileEmployee.employmentCertificateDocumentFiles || [],
        toeicScoreDocumentName: profileEmployee.toeicScoreDocumentName || "",
        toeicScoreDocumentData: profileEmployee.toeicScoreDocumentData || "",
        toeicScoreDocumentFiles: profileEmployee.toeicScoreDocumentFiles || [],
        driverLicenseDocumentName: profileEmployee.driverLicenseDocumentName || "",
        driverLicenseDocumentData: profileEmployee.driverLicenseDocumentData || "",
        driverLicenseDocumentFiles: profileEmployee.driverLicenseDocumentFiles || [],
        bankBookDocumentName: profileEmployee.bankBookDocumentName || "",
        bankBookDocumentData: profileEmployee.bankBookDocumentData || "",
        bankBookDocumentFiles: profileEmployee.bankBookDocumentFiles || [],
      });
      setIsEditing(false);
    }
  }, [isOpen, employee, hydratedEmployee]);

  // Keep the underlying page fixed while the drawer owns the viewport.
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const root = document.documentElement;
    const previousBodyStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    const previousRootStyles = {
      overflow: root.style.overflow,
      overscrollBehavior: root.style.overscrollBehavior,
    };

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";

    return () => {
      body.style.overflow = previousBodyStyles.overflow;
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.width = previousBodyStyles.width;
      root.style.overflow = previousRootStyles.overflow;
      root.style.overscrollBehavior = previousRootStyles.overscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  useEffect(() => {
    setIsDocumentsSheetOpen(false);
    setActiveProfileTab("personal");
  }, [isOpen, employee?.id]);

  const requestConfirmation = (dialog: ConfirmationDialog) => {
    return new Promise<boolean>((resolve) => {
      confirmationResolverRef.current = resolve;
      setConfirmationDialog(dialog);
    });
  };

  const closeConfirmation = (confirmed: boolean) => {
    confirmationResolverRef.current?.(confirmed);
    confirmationResolverRef.current = null;
    setConfirmationDialog(null);
  };

  const handleSave = async () => {
    if (!editedData) return;
    setIsSaving(true);
    try {
      const payload = { ...editedData };
      if (payload.titlePrefix) {
        const [thPrefix, enPrefix] = payload.titlePrefix.split(" / ");
        payload.name = `${thPrefix} ${payload.firstNameTh || ""} ${payload.lastNameTh || ""}`.trim();
        payload.nameEn = `${enPrefix} ${payload.firstNameEn || ""} ${payload.lastNameEn || ""}`.trim();
      }

      const res = await fetch("/api/employees/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const result = await res.json();
        const nextEmployee = mergeServerEmployee(payload, result.updatedItem);
        setIsEditing(false);
        setEditedData(nextEmployee);
        if (onUpdate) onUpdate(nextEmployee);
      } else {
        const errorData = await res.json();
        alert(`Failed to save employee data: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error saving data");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePassProbation = () => {
    setIsPassProbationOpen(true);
  };

  const handlePassProbationSave = async (probationPassData: {
    probationPassOperatorId: string;
    probationPassOperatorName: string;
    probationPassOperatorPosition: string;
    probationPassDate: string;
    probationPassAttachmentName: string;
    probationPassAttachmentData: string;
    outcome: "pass" | "fail" | "extend";
    lastWorkingDate?: string;
    extensionDays?: number;
    newProbationEndDate?: string;
  }) => {
    if (!employee) return;
    setIsSaving(true);
    try {
      const payload: Partial<EmployeeData> & { id: string; employeeName?: string } = {
        id: employee.id,
        employeeName: employee.name,
        probationPassOperatorId: probationPassData.probationPassOperatorId,
        probationPassOperatorName: probationPassData.probationPassOperatorName,
        probationPassOperatorPosition: probationPassData.probationPassOperatorPosition,
        probationPassDate: probationPassData.probationPassDate,
        probationPassAttachmentName: probationPassData.probationPassAttachmentName,
        probationPassAttachmentData: probationPassData.probationPassAttachmentData,
        probationOutcome: probationPassData.outcome,
      };

      if (probationPassData.outcome === "pass") {
        payload.empType = "Normal";
        payload.status = "Active";
      } else if (probationPassData.outcome === "fail") {
        payload.empType = "Probation";
        payload.lastWorkingDate = probationPassData.lastWorkingDate;
        payload.resignDate = probationPassData.lastWorkingDate;
      } else if (probationPassData.outcome === "extend") {
        payload.empType = "Probation";
        payload.probationExtensionDays = probationPassData.extensionDays;
        if (probationPassData.newProbationEndDate) {
          payload.probationEnd = probationPassData.newProbationEndDate;
        }
      }
      
      const res = await fetch("/api/employees/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const result = await res.json();
        if (onUpdate) onUpdate(mergeServerEmployee({ ...employee, ...payload }, result.updatedItem));
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Unknown error');
      }
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof EmployeeData, value: string) => {
    if (editedData) {
      const updates: Partial<EmployeeData> = { [field]: value };
      
      // Cascading logic: reset children when parent changes
      if (field === 'department') {
        updates.division = "-";
        updates.section = "-";
        updates.unit = "-";
        updates.title = "-"; // Reset position if department changes
      } else if (field === 'division') {
        updates.section = "-";
        updates.unit = "-";
      } else if (field === 'section') {
        updates.unit = "-";
      }

      setEditedData({ ...editedData, ...updates });
    }
  };

  // --- Helper to format name with code ---
  const formatWithCode = (name: string | undefined, code: string | undefined) => {
    if (!name || name === "-") return "-";
    if (code && code !== "-") return `${name} (${code})`;
    return name;
  };

  // --- Derived Data for Dropdowns ---
  const departments = useMemo(() => {
    return Array.from(new Set(orgData.map(item => formatWithCode(item.department_en, item.department_code)).filter(v => v !== "-")));
  }, [orgData]);

  const divisions = useMemo(() => {
    if (!editedData?.department || editedData.department === "-") return [];
    return Array.from(new Set(orgData
      .filter(item => formatWithCode(item.department_en, item.department_code) === editedData.department)
      .map(item => formatWithCode(item.division_en, item.division_code))
      .filter(v => v !== "-")
    ));
  }, [orgData, editedData?.department]);

  const sections = useMemo(() => {
    if (!editedData?.division || editedData.division === "-") return [];
    return Array.from(new Set(orgData
      .filter(item => formatWithCode(item.department_en, item.department_code) === editedData?.department && 
                      formatWithCode(item.division_en, item.division_code) === editedData.division)
      .map(item => formatWithCode(item.section_en, item.section_code))
      .filter(v => v !== "-")
    ));
  }, [orgData, editedData?.department, editedData?.division]);

  const units = useMemo(() => {
    if (!editedData?.section || editedData.section === "-") return [];
    return Array.from(new Set(orgData
      .filter(item => formatWithCode(item.department_en, item.department_code) === editedData?.department && 
                      formatWithCode(item.division_en, item.division_code) === editedData?.division && 
                      formatWithCode(item.section_en, item.section_code) === editedData.section)
      .map(item => formatWithCode(item.unit_en, item.unit_code))
      .filter(v => v !== "-")
    ));
  }, [orgData, editedData?.department, editedData?.division, editedData?.section]);

  const stations = useMemo(() => {
    return Array.from(new Set(orgData.map(item => item.station).filter(v => v && v !== "-")));
  }, [orgData]);

  const positions = useMemo(() => {
    let filtered = orgData;
    if (editedData?.department && editedData.department !== "-") {
      filtered = filtered.filter(item => formatWithCode(item.department_en, item.department_code) === editedData.department);
    }
    return Array.from(new Set(filtered.map(item => item.position_en).filter(v => v && v !== "-")));
  }, [orgData, editedData?.department]);

  // ------------------------------------

  const displayEmployee = isEditing && editedData ? editedData : hydratedEmployee || employee;

  const getTitleParts = (titlePrefix?: string) => {
    const clean = titlePrefix && titlePrefix !== "-" ? titlePrefix.trim() : "";
    if (!clean) return { th: "", en: "" };
    const [thPart, enPart] = clean.split(" / ").map((part) => part?.trim() || "");
    return { th: thPart || "", en: enPart || thPart || "" };
  };

  const nameHasTitle = (name: string, locale: "th" | "en") => {
    if (locale === "th") return /^(\u0e19\u0e32\u0e22|\u0e19\u0e32\u0e07\u0e2a\u0e32\u0e27|\u0e19\u0e32\u0e07)\s*/.test(name);
    return /^(Mr\.?|Mrs\.?|Miss|Ms\.?)\s+/i.test(name);
  };

  const withTitlePrefix = (name?: string, title?: string, locale: "th" | "en" = "en") => {
    const cleanName = name && name !== "-" ? name.trim() : "";
    const cleanTitle = title && title !== "-" ? title.trim() : "";
    if (!cleanName) return "-";
    if (!cleanTitle || nameHasTitle(cleanName, locale)) return cleanName;
    return locale === "th" ? cleanTitle + cleanName : cleanTitle + " " + cleanName;
  };

  const employeeTitleParts = getTitleParts(displayEmployee?.titlePrefix);
  const displayHeaderName = displayEmployee
    ? withTitlePrefix(displayEmployee.nameEn !== "-" ? displayEmployee.nameEn : displayEmployee.name, displayEmployee.nameEn !== "-" ? employeeTitleParts.en : employeeTitleParts.th, displayEmployee.nameEn !== "-" ? "en" : "th")
    : "-";
  const displayHeaderSubName = displayEmployee?.nameEn !== "-"
    ? withTitlePrefix(displayEmployee?.name, employeeTitleParts.th, "th")
    : "";

  const handleRefreshDetails = async () => {
    if (!displayEmployee?.id || isRefreshingDetails || isLoadingDetails || isEditing) return;

    setIsRefreshingDetails(true);
    try {
      const res = await fetch(`/api/employees?id=${encodeURIComponent(displayEmployee.id)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to refresh employee detail: ${res.status}`);
      const item = await res.json();
      const nextEmployee = mergeServerEmployee(displayEmployee, item);
      setHydratedEmployee(nextEmployee);
      if (onUpdate) onUpdate(nextEmployee);
    } catch (error) {
      console.error("Error refreshing employee detail", error);
      alert("Error refreshing employee details");
    } finally {
      setIsRefreshingDetails(false);
    }
  };

  const renderField = (label: string, field: keyof EmployeeData, isLocked = false, isTextArea = false, dropdownOptions?: string[], isDate = false) => {
    const val = (isEditing ? editedData?.[field] : displayEmployee?.[field]) as any as string;
    
    if (isEditing && !isLocked) {
      if (dropdownOptions) {
        return (
          <div className="w-full">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">{label}</span>
            <CustomSelect 
              value={val || "-"} 
              onChange={(v) => handleChange(field, v)}
              options={dropdownOptions}
            />
          </div>
        );
      }

      if (isDate) {
        const dateVal = val && val !== "-" ? val.substring(0, 10) : "";
        return (
          <div className="w-full">
            <span className="text-[11px] text-slate-500 mb-0.5 block">{label}</span>
            <input 
              type="date" 
              value={dateVal} 
              onChange={(e) => handleChange(field, e.target.value)}
              className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 truncate"
            />
          </div>
        );
      }
      
      if (isTextArea) {
        return (
          <div className="w-full">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">{label}</span>
            <textarea 
              value={val || ""} 
              onChange={(e) => handleChange(field, e.target.value)}
              className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 min-h-[50px]"
            />
          </div>
        );
      }
      
      return (
        <div className="w-full">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">{label}</span>
          <input 
            type="text" 
            value={val || ""} 
            onChange={(e) => handleChange(field, e.target.value)}
            className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 truncate"
          />
        </div>
      );
    }
    
    const formatDisplayVal = (v: any) => {
      if (field === 'gender') return v === 'M' ? 'Male' : v === 'F' ? 'Female' : v;
      if (isDate && v && v !== "-") {
        const d = new Date(v);
        if (!isNaN(d.getTime())) {
          return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }
      }
      return v;
    };

    const renderDisplayContent = (v: any) => {
      const formatted = formatDisplayVal(v);
      if (typeof formatted === 'string' && formatted.includes(' / ')) {
        const parts = formatted.split(' / ');
        return (
          <>
            <span className="block text-[13px] text-slate-700 dark:text-slate-300 leading-tight mb-0.5">{parts[1]}</span>
            <span className="block text-[13px] text-slate-500 dark:text-slate-400 leading-tight">{parts[0]}</span>
          </>
        );
      }
      return <span className="block text-[13px] text-slate-700 dark:text-slate-300">{formatted}</span>;
    };

    return (
      <div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{label}</span>
        {renderDisplayContent(val)}
      </div>
    );
  };

  const renderProbationDaysField = () => (
    <div>
      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{"\u0e08\u0e33\u0e19\u0e27\u0e19\u0e27\u0e31\u0e19\u0e17\u0e14\u0e25\u0e2d\u0e07\u0e07\u0e32\u0e19"} / Probation Days</span>
      <span className="block text-[13px] text-slate-700 dark:text-slate-300">{probationDaysText}</span>
    </div>
  );

  const [copiedLineId, setCopiedLineId] = useState(false);

  const handleCopyLineId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLineId(true);
    setTimeout(() => setCopiedLineId(false), 2000);
  };

  const hasDocumentFile = (file?: EmployeeDocumentFile) => {
    return Boolean(file?.name && file.name !== "-" && file?.data && file.data !== "-");
  };

  const getDocumentFiles = (source: EmployeeData | null | undefined, document: EmployeeDocumentConfig): EmployeeDocumentFile[] => {
    if (!source) return [];

    const rawFiles = source[document.filesField];
    const files = Array.isArray(rawFiles)
      ? rawFiles.filter((file): file is EmployeeDocumentFile => hasDocumentFile(file as EmployeeDocumentFile))
      : [];

    const legacyName = source[document.nameField] as string | undefined;
    const legacyData = source[document.dataField] as string | undefined;
    if (legacyName && legacyName !== "-" && legacyData && legacyData !== "-") {
      const alreadyIncluded = files.some((file) => file.data === legacyData || (file.name === legacyName && file.data === legacyData));
      if (!alreadyIncluded) {
        files.push({ name: legacyName, data: legacyData });
      }
    }

    return files;
  };

  const latestDocumentFile = (files: EmployeeDocumentFile[]) => files[files.length - 1];

  const handleDocumentFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    document: EmployeeDocumentConfig
  ) => {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = "";
    if (selectedFiles.length === 0) return;

    const invalidFile = selectedFiles.find((file) => !(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")));
    if (invalidFile) {
      alert("Please upload PDF files only");
      return;
    }

    const oversizedFile = selectedFiles.find((file) => file.size > MAX_DOCUMENT_FILE_SIZE_BYTES);
    if (oversizedFile) {
      alert(`Each file size must not exceed ${MAX_DOCUMENT_FILE_SIZE_MB}MB`);
      return;
    }

    Promise.all(selectedFiles.map((file) => new Promise<EmployeeDocumentFile>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        name: file.name,
        data: reader.result as string,
        uploadedAt: new Date().toISOString(),
      });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }))).then(async (newFiles) => {
      const source = isEditing ? editedData : displayEmployee;
      const nextFiles = [...getDocumentFiles(source, document), ...newFiles];
      const latestFile = latestDocumentFile(nextFiles);

      if (!isEditing && displayEmployee) {
        setIsSaving(true);
        try {
          const payload = {
            id: displayEmployee.id,
            updateScope: "documents",
            employeeName: displayEmployee.name,
            [document.filesField]: nextFiles,
            [document.nameField]: latestFile?.name || "",
            [document.dataField]: latestFile?.data || "",
          };

          const res = await fetch("/api/employees/update", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const result = await res.json();
            const nextEmployee = mergeServerEmployee(displayEmployee, result.updatedItem);
            setHydratedEmployee(nextEmployee);
            setEditedData(nextEmployee);
            if (onUpdate) onUpdate(nextEmployee);
          } else {
            const errorData = await res.json();
            alert("Failed to upload document: " + (errorData.error || "Unknown error"));
          }
        } catch (err) {
          console.error(err);
          alert("Error uploading document");
        } finally {
          setIsSaving(false);
        }
        return;
      }

      setEditedData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [document.filesField]: nextFiles,
          [document.nameField]: latestFile?.name || "",
          [document.dataField]: latestFile?.data || "",
        };
      });
    }).catch((err) => {
      console.error(err);
      alert("Error reading document");
    });
  };

  const handleRemoveDocumentFile = async (document: EmployeeDocumentConfig, fileIndex: number) => {
    const confirmed = await requestConfirmation({
      title: "Delete Document",
      description: "Delete this file from this employee?",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      tone: "danger",
    });
    if (!confirmed) return;

    const source = isEditing ? editedData : displayEmployee;
    const currentFiles = getDocumentFiles(source, document);
    const nextFiles = currentFiles.filter((_, index) => index !== fileIndex);
    const latestFile = latestDocumentFile(nextFiles);

    if (!isEditing && displayEmployee) {
      setIsSaving(true);
      try {
        const payload = {
          id: displayEmployee.id,
          updateScope: "documents",
          [document.filesField]: nextFiles,
          [document.nameField]: latestFile?.name || "",
          [document.dataField]: latestFile?.data || "",
        };

        const res = await fetch("/api/employees/update", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const result = await res.json();
          const nextEmployee = mergeServerEmployee(displayEmployee, result.updatedItem);
          setHydratedEmployee(nextEmployee);
          setEditedData(nextEmployee);
          if (onUpdate) onUpdate(nextEmployee);
        } else {
          const errorData = await res.json();
          alert("Failed to delete document: " + (errorData.error || "Unknown error"));
        }
      } catch (err) {
        console.error(err);
        alert("Error deleting document");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setEditedData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [document.filesField]: nextFiles,
        [document.nameField]: latestFile?.name || "",
        [document.dataField]: latestFile?.data || "",
      };
    });
  };

  // Resolves a stored attachment value into an openable URL. Inline data: URLs,
  // absolute URLs and legacy /uploads paths are used directly; anything else is
  // treated as a private S3 object key and exchanged for a short-lived presigned
  // URL via /api/attachments. Returns null if resolution fails.
  const resolveAttachmentUrl = async (
    value: string,
    opts?: { disposition?: "inline" | "attachment"; name?: string }
  ): Promise<string | null> => {
    if (value.startsWith("data:") || /^https?:\/\//i.test(value)) {
      return value;
    }
    if (value.startsWith("/")) {
      return `${window.location.origin}${value}`;
    }

    try {
      const params = new URLSearchParams({ key: value });
      if (opts?.disposition) params.set("disposition", opts.disposition);
      if (opts?.name) params.set("name", opts.name);
      const res = await fetch(`/api/attachments?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.url) return json.url;
      console.error("Failed to resolve attachment URL:", json.error);
      return null;
    } catch (e) {
      console.error("Failed to resolve attachment URL:", e);
      return null;
    }
  };

  const downloadDataUrl = async (dataUrl?: string, name?: string) => {
    if (!dataUrl || dataUrl === "-") return;

    const url = await resolveAttachmentUrl(dataUrl, {
      disposition: "attachment",
      name,
    });
    if (!url) {
      alert("ไม่สามารถดาวน์โหลดเอกสารได้ / Unable to download document");
      return;
    }

    const link = document.createElement("a");
    link.href = url;
    link.download = name || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewAttachment = async (dataUrl?: string, name?: string) => {
    if (!dataUrl || dataUrl === "-") return;

    // Open the window synchronously (inside the click handler) so the popup
    // blocker allows it, then fill it once the presigned URL resolves.
    const previewWindow = window.open();
    if (!previewWindow) return;
    previewWindow.document.write(
      "<!doctype html><title>Loading…</title><body style='font-family:sans-serif;padding:24px;color:#334155'>กำลังโหลดเอกสาร / Loading document…</body>"
    );

    const safeTitle = (name || "Attached document").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[char] || char));
    const attachmentUrl = await resolveAttachmentUrl(dataUrl, {
      disposition: "inline",
      name,
    });

    if (!attachmentUrl) {
      previewWindow.document.open();
      previewWindow.document.write(
        "<!doctype html><title>Error</title><body style='font-family:sans-serif;padding:24px;color:#b91c1c'>ไม่สามารถเปิดเอกสารได้ / Unable to open document</body>"
      );
      previewWindow.document.close();
      return;
    }

    previewWindow.document.open();
    previewWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${safeTitle}</title>
          <style>
            html, body { margin: 0; width: 100%; height: 100%; background: #0f172a; }
            iframe { width: 100%; height: 100%; border: 0; background: white; }
          </style>
        </head>
        <body>
          <iframe src="${attachmentUrl}" title="Attached document preview"></iframe>
        </body>
      </html>
    `);
    previewWindow.document.close();
  };

  const getEmployeeDocuments = (): EmployeeDocumentItem[] => {
    if (!displayEmployee) return [];

    return EMPLOYEE_DOCUMENT_FIELDS.flatMap((document) =>
      getDocumentFiles(displayEmployee, document).map((file, index) => ({
        id: document.id + "-" + index,
        label: document.label,
        data: file.data,
        name: file.name,
      }))
    );
  };

  const handleViewEmployeeDocuments = () => {
    if (!displayEmployee) return;
    setIsDocumentsSheetOpen(true);
  };

  const handleSyncDocumentFolders = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/employees/document-folders/sync", { method: "POST" });
      const result = await res.json();
      if (!res.ok) {
        alert("Failed to sync document folders: " + (result.error || "Unknown error"));
        return;
      }
      alert(
        "Document folders synced. Created: " +
          result.createdFolders +
          " / Skipped: " +
          result.skippedFolders +
          (result.failedEmployees ? " / Failed employees: " + result.failedEmployees : "")
      );
    } catch (error) {
      console.error(error);
      alert("Error syncing document folders");
    } finally {
      setIsSaving(false);
    }
  };

  const probationDaysText = useMemo(() => {
    const explicitDays = displayEmployee?.probationDays;
    if (explicitDays !== undefined && explicitDays !== null && explicitDays !== "" && explicitDays !== "-") {
      const numeric = Number(explicitDays);
      return Number.isFinite(numeric) ? numeric + " \u0e27\u0e31\u0e19" : String(explicitDays);
    }

    const startDateStr = displayEmployee?.contractStart;
    const probationEndStr = displayEmployee?.probationEnd;
    if (!startDateStr || startDateStr === "-" || !probationEndStr || probationEndStr === "-") return "-";

    const start = new Date(startDateStr);
    const end = new Date(probationEndStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "-";

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays + " \u0e27\u0e31\u0e19" : "-";
  }, [displayEmployee?.probationDays, displayEmployee?.contractStart, displayEmployee?.probationEnd]);
  const tenureText = useMemo(() => {
    const startDateStr = displayEmployee?.contractStart;
    const resignDateStr = displayEmployee?.resignDate;
    
    if (!startDateStr || startDateStr === "-") return "-";
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return "-";
    
    const end = resignDateStr && resignDateStr !== "-" ? new Date(resignDateStr) : new Date();
    if (isNaN(end.getTime())) return "-";
    
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();
    
    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      days += prevMonth.getDate();
    }
    
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    
    const parts = [];
    if (years > 0) parts.push(`${years} ปี (Years)`);
    if (months > 0) parts.push(`${months} เดือน (Months)`);
    if (days > 0 || parts.length === 0) parts.push(`${days} วัน (Days)`);
    
    return parts.join(" ");
  }, [displayEmployee?.contractStart, displayEmployee?.resignDate]);

  const canPassProbation = Boolean(
    displayEmployee?.empType?.toLowerCase() === "probation" &&
    (!displayEmployee.status || displayEmployee.status.toLowerCase() !== "resign") &&
    (!displayEmployee.resignDate || displayEmployee.resignDate === "-"),
  );


  return (
    <>
    <AnimatePresence>
      {isOpen && displayEmployee && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={cn(
              "fixed inset-0 z-50",
              blurBackground
                ? "bg-black/30 backdrop-blur-[2px] dark:bg-black/60"
                : "bg-black/30 dark:bg-black/60",
            )}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white dark:bg-[#0a0a0a] border-l border-slate-100 dark:border-white/5 shadow-2xl z-50 overflow-y-auto scrollbar-none"
          >
            {/* Header with Gradient */}
            <div className="relative h-28 bg-gradient-to-r from-purple-400 via-fuchsia-400 to-amber-300 dark:from-purple-900 dark:via-fuchsia-900 dark:to-amber-900">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 bg-white/20 hover:bg-white/40 dark:bg-black/30 dark:hover:bg-black/50 rounded-full text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Info */}
            <div className="px-5 pb-5 relative -mt-9">
              <div className="flex items-end justify-between gap-2 mb-3">
                <div className={cn("w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold text-white border-4 border-white dark:border-[#0a0a0a] shadow-md shrink-0 overflow-hidden relative bg-slate-100 dark:bg-slate-900", displayEmployee.colorClass)}>
                    {displayEmployee.initials}
                </div>

                <div className="flex-1 min-w-0 px-1 sm:px-4 pb-2">
                  <p className="font-mono text-base sm:text-xl font-extrabold tracking-wide text-slate-700 dark:text-slate-200 leading-none truncate">
                    @{displayEmployee.id}
                  </p>
                </div>
                
                <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => setIsEditing(false)}
                        disabled={isSaving}
                        className="px-3 py-1.5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95 transition-all disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-black hover:to-slate-900 dark:from-white dark:to-slate-100 dark:hover:from-slate-100 dark:hover:to-white text-white dark:text-black rounded-xl text-xs font-semibold shadow-md active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                      </button>
                    </>
                  ) : (
                    <>
                      {canPassProbation && (
                        <button
                          onClick={handlePassProbation}
                          disabled={isSaving}
                          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:via-teal-600 hover:to-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/15 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all duration-200 disabled:opacity-50 border border-emerald-400/20"
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Pass Probation</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleRefreshDetails}
                        disabled={isRefreshingDetails || isLoadingDetails}
                        className="inline-flex h-8 w-8 items-center justify-center text-sky-600 transition-colors hover:text-sky-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-300 dark:hover:text-sky-200"
                        title="Refresh employee details"
                        aria-label="Refresh employee details"
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5", (isRefreshingDetails || isLoadingDetails) && "animate-spin")} />
                      </button>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex h-8 w-8 items-center justify-center text-slate-600 transition-colors hover:text-slate-900 active:scale-95 dark:text-slate-300 dark:hover:text-white"
                        title="Edit profile"
                        aria-label="Edit profile"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-start">
                <div className="flex-1 mr-4">
                  {isEditing ? (
                    <div className="space-y-3 w-full">
                      <div>
                        <span className="text-[11px] text-slate-500 mb-0.5 block">คำนำหน้า / Title</span>
                        <CustomSelect 
                          value={editedData?.titlePrefix || "นาย / Mr."} 
                          onChange={(v) => handleChange("titlePrefix", v)}
                          options={["นาย / Mr.", "นาง / Mrs.", "นางสาว / Miss"]}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[11px] text-slate-500 mb-0.5 block">ชื่อ (TH)</span>
                          <input type="text" value={editedData?.firstNameTh || ""} onChange={e => handleChange("firstNameTh", e.target.value)} className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 truncate" />
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 mb-0.5 block">นามสกุล (TH)</span>
                          <input type="text" value={editedData?.lastNameTh || ""} onChange={e => handleChange("lastNameTh", e.target.value)} className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 truncate" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[11px] text-slate-500 mb-0.5 block">First Name (EN)</span>
                          <input type="text" value={editedData?.firstNameEn || ""} onChange={e => handleChange("firstNameEn", e.target.value)} className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 font-bold truncate" />
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 mb-0.5 block">Last Name (EN)</span>
                          <input type="text" value={editedData?.lastNameEn || ""} onChange={e => handleChange("lastNameEn", e.target.value)} className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 font-bold truncate" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{displayHeaderName}</h2>
                      {displayHeaderSubName && <p className="text-sm text-slate-600 dark:text-slate-300 font-normal mt-1">{displayHeaderSubName}</p>}
                    </>
                  )}
                </div>
                <div className="flex items-center text-slate-400 mt-2">
                  <MapPin className="w-4 h-4 mr-1" />
                </div>
              </div>


              {/* Tags */}
              {!isEditing && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    {displayEmployee.title}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    {displayEmployee.station}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    {displayEmployee.empType || "Normal"}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all",
                    displayEmployee.status && displayEmployee.status.toLowerCase() === "active"
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                      : displayEmployee.status && displayEmployee.status.toLowerCase().includes("resign")
                        ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20"
                        : "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10"
                  )}>
                    {displayEmployee.status}
                  </span>
                  {displayEmployee.pending_adjustment && (
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-md text-[11px] font-medium">
                      Pending {displayEmployee.pending_adjustment.type || "Update"}: {displayEmployee.pending_adjustment.effectiveDate}
                    </span>
                  )}
                </div>
              )}

              {!isEditing && canPassProbation && (
                <button
                  type="button"
                  onClick={handlePassProbation}
                  disabled={isSaving}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/20 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/15 transition-all active:scale-[0.99] disabled:opacity-50 sm:hidden"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Pass Probation</span>
                </button>
              )}

              <div className="mt-4 border-b border-slate-200 dark:border-white/10 overflow-x-auto scrollbar-none">
                <div className="flex min-w-max gap-1">
                  {EMPLOYEE_PROFILE_TABS.map((tab) => {
                    const isActive = activeProfileTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveProfileTab(tab.id)}
                        className={cn(
                          "relative px-3 py-2 text-[11px] font-bold transition-colors whitespace-nowrap",
                          isActive
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        )}
                      >
                        {tab.label}
                        <span className={cn(
                          "absolute left-0 right-0 -bottom-px h-0.5 rounded-full transition-opacity",
                          isActive ? "bg-blue-600 dark:bg-blue-400 opacity-100" : "opacity-0"
                        )} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {/* Personal Info Section */}
                {activeProfileTab === "personal" && (
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 mb-3">Personal Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                      <div className="p-1.5 bg-slate-100 dark:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-[13px] font-medium text-slate-900 dark:text-slate-100">Identity</h4>
                        <div className="grid grid-cols-1 gap-3 mt-3">
                          {isEditing ? (
                            <>
                              {renderField("\u0e04\u0e33\u0e19\u0e33\u0e2b\u0e19\u0e49\u0e32 / Title", "titlePrefix", false, false, ["\u0e19\u0e32\u0e22 / Mr.", "\u0e19\u0e32\u0e07 / Mrs.", "\u0e19\u0e32\u0e07\u0e2a\u0e32\u0e27 / Miss"])}
                              {renderField("ID Card", "idCard")}
                              {renderField("Nickname / ชื่อเล่น", "nickname")}
                              {renderField("Birth Date / \u0e27\u0e31\u0e19\u0e40\u0e01\u0e34\u0e14", "birthDate", false, false, undefined, true)}
                              {renderField("Age / \u0e2d\u0e32\u0e22\u0e38", "age", true)}
                              <div className="grid grid-cols-2 gap-3">
                                {renderField("Gender", "gender", false, false, ["M", "F"])}
                                {renderField("Nationality", "nationality")}
                              </div>
                              {renderField("เลขบัญชีธนาคาร / Bank Account", "bankAccount")}
                            </>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                              <div>{renderField("\u0e04\u0e33\u0e19\u0e33\u0e2b\u0e19\u0e49\u0e32 / Title", "titlePrefix")}</div>
                              <div>{renderField("Name (TH)", "name")}</div>
                              <div>{renderField("Name (EN)", "nameEn")}</div>
                              <div>{renderField("Nickname / ชื่อเล่น", "nickname")}</div>
                              <div>{renderField("Birth Date / \u0e27\u0e31\u0e19\u0e40\u0e01\u0e34\u0e14", "birthDate", false, false, undefined, true)}</div>
                              <div>{renderField("ID Card", "idCard")}</div>
                              <div>{renderField("Age / \u0e2d\u0e32\u0e22\u0e38", "age", true)}</div>
                              <div>{renderField("Gender", "gender")}</div>
                              <div>{renderField("Nationality", "nationality")}</div>
                              <div className="sm:col-span-2">{renderField("เลขบัญชีธนาคาร / Bank Account", "bankAccount")}</div>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* Contact & Address Section */}
                {activeProfileTab === "personal" && (
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 mb-3">Contact & Address</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                      <div className="p-1.5 bg-purple-50 dark:bg-purple-500/10 rounded-lg text-purple-500 dark:text-purple-400">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="flex-1 space-y-3 mt-0.5">
                        {renderField("Email", "email")}
                        {renderField("Phone", "phone")}
                        {renderField("Address", "address", false, true)}
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* Employment Details Section */}
                {activeProfileTab === "personal" && (
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 mb-3">Employment Details</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                      <div className="p-1.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-500 dark:text-blue-400">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div className="flex-1 space-y-3 mt-0.5">
                        {isEditing ? (
                          <div className="grid grid-cols-1 gap-3">
                            {renderField("Position", "title", false, false, positions)}
                            {renderField("Department", "department", false, false, departments)}
                            {renderField("Division", "division", false, false, divisions)}
                            {renderField("Section", "section", false, false, sections)}
                            {renderField("Unit", "unit", false, false, units)}
                            {renderField("Station", "station", false, false, stations)}
                            {renderField("Supervisor", "supervisor")}
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 gap-2">
                              {renderField("Position", "title")}
                              {renderField("Department", "department")}
                              {renderField("Division", "division")}
                              {renderField("Section", "section")}
                              {renderField("Unit", "unit")}
                              {renderField("Station", "station")}
                              {renderField("Supervisor", "supervisor")}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                      <div className="p-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-amber-500 dark:text-amber-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="flex-1 space-y-3 mt-0.5">
                        {isEditing ? (
                          <>
                            {renderField("Start Date", "contractStart", false, false, undefined, true)}
                            {renderField("Probation End", "probationEnd", false, false, undefined, true)}
                            {renderProbationDaysField()}
                            {renderField("Contract End", "contractEnd", false, false, undefined, true)}
                            {displayEmployee.resignDate && displayEmployee.resignDate !== "-" && renderField("Resign Date", "resignDate", false, false, undefined, true)}
                          </>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              {renderField("Start Date", "contractStart", false, false, undefined, true)}
                              {renderField("Probation End", "probationEnd", false, false, undefined, true)}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {renderProbationDaysField()}
                              {renderField("Contract End", "contractEnd", false, false, undefined, true)}
                              {displayEmployee.resignDate && displayEmployee.resignDate !== "-" && renderField("Resign Date", "resignDate", false, false, undefined, true)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* Additional Info Section */}
                {activeProfileTab === "personal" && (
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 mb-3">Additional Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                      <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-500 dark:text-indigo-400">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex-1 space-y-3 mt-0.5">
                        {renderField("Education", "education", false, true)}
                        {renderField("Work History", "workHistory", false, true)}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                      <div className="p-1.5 bg-red-50 dark:bg-red-500/10 rounded-lg text-red-500 dark:text-red-400">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex-1 space-y-3 mt-0.5">
                        <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">Emergency Contact</h4>
                        {isEditing ? (
                          <div className="grid grid-cols-1 gap-3">
                            {renderField("Contact Name", "emergencyContactName", false, false)}
                            {renderField("Relationship", "emergencyContactRelation", false, false)}
                            {renderField("Phone", "emergencyContactPhone", false, false)}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-2">
                            {renderField("Contact Name", "emergencyContactName")}
                            {renderField("Relationship", "emergencyContactRelation")}
                            {renderField("Phone", "emergencyContactPhone")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* Documents Section */}
                {activeProfileTab === "documents" && (
                <div id="employee-documents-section">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Documents</h3>
                    <button
                      type="button"
                      onClick={handleSyncDocumentFolders}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-[10.5px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      Sync Folders
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {EMPLOYEE_DOCUMENT_FIELDS.map((document, index) => {
                      const documentFiles = getDocumentFiles(isEditing ? editedData : displayEmployee, document);
                      const hasFile = documentFiles.length > 0;

                      return (
                        <div key={document.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold",
                            hasFile
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                          )}>
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">{document.label}</p>
                                <p className={cn(
                                  "text-[10.5px] font-medium mt-0.5",
                                  hasFile ? "text-emerald-600 dark:text-emerald-400" : "text-slate-450 italic"
                                )}>
                                  {hasFile ? (documentFiles.length + " file" + (documentFiles.length > 1 ? "s" : "") + " uploaded") : "No document"}
                                </p>
                              </div>
                              <label className={cn(
                                "relative inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-[10.5px] font-extrabold text-sky-600 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors shrink-0",
                                isSaving ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer"
                              )}>
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                Upload PDF
                                <input
                                  type="file"
                                  onChange={(e) => handleDocumentFileChange(e, document)}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                  accept=".pdf,application/pdf"
                                  disabled={isSaving}
                                  multiple
                                />
                              </label>
                            </div>

                            {hasFile && (
                              <div className="space-y-2">
                                {documentFiles.map((file, fileIndex) => (
                                  <div key={document.id + "-" + fileIndex + "-" + file.name} className="w-full flex items-center justify-between gap-2 p-2.5 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                                      <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold truncate">{file.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleViewAttachment(file.data, file.name)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-extrabold text-sky-600 dark:text-sky-400 uppercase bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 rounded-lg transition-colors cursor-pointer"
                                        title="View document"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        View
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => downloadDataUrl(file.data, file.name)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer"
                                        title="Download document"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        Download
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveDocumentFile(document, fileIndex)}
                                        disabled={isSaving}
                                        className="p-1.5 text-rose-500 hover:text-rose-600 transition-colors cursor-pointer rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Remove document"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}

                {/* Extended Info Section */}
                {activeProfileTab === "personal" && (
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 mb-4">ข้อมูลพนักงานเพิ่มเติม / Extended Info</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                      <div className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-500 dark:text-emerald-400">
                        <Award className="w-4 h-4" />
                      </div>
                      <div className="flex-1 space-y-3 mt-0.5">

                        {/* 2. อายุงาน (Read Only) */}
                        <div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">อายุงาน / Tenure</span>
                          <span className="text-[13px] text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                            {tenureText}
                          </span>
                        </div>

                        {/* 3. line_webhook */}
                        {isEditing ? (
                          <div className="space-y-3">
                            {renderField("LINE User ID (สำหรับการลงทะเบียน LINE Webhook)", "lineUserId")}
                            {renderField("LINE Avatar URL (รูปโปรไฟล์ LINE)", "lineAvatarUrl")}
                          </div>
                        ) : (
                          <div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">สถานะการเชื่อมต่อ LINE / LINE Webhook</span>
                            {displayEmployee.lineUserId && displayEmployee.lineUserId !== "-" && displayEmployee.lineUserId !== "" ? (
                              <div className="mt-1.5 space-y-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full border border-emerald-200 dark:border-emerald-500/20">
                                  <Check className="w-3.5 h-3.5" /> เชื่อมต่อแล้ว (Connected)
                                </span>
                                <div className="flex gap-2 items-center bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs">
                                  <span className="font-mono text-slate-650 dark:text-slate-350 truncate flex-1">{displayEmployee.lineUserId}</span>
                                  <button
                                    onClick={() => handleCopyLineId(displayEmployee.lineUserId!)}
                                    className="p-1 hover:text-white transition-colors cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-white/5"
                                    title="คัดลอก LINE User ID"
                                  >
                                    {copiedLineId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-450 text-xs font-medium rounded-full border border-slate-200 dark:border-white/10 mt-1.5">
                                ยังไม่ได้เชื่อมต่อ LINE (Not Connected)
                              </span>
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                </div>
                )}
                {activeProfileTab === "system" && displayEmployee.databaseDetails && displayEmployee.databaseDetails.length > 0 && (
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 mb-3">Database Details</h3>
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                      <div className="p-1.5 bg-cyan-50 dark:bg-cyan-500/10 rounded-lg text-cyan-500 dark:text-cyan-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 mt-0.5">
                        {displayEmployee.databaseDetails.map((detail) => (
                          <div key={detail.label} className="min-w-0">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{detail.label}</span>
                            <span className="block text-[13px] text-slate-700 dark:text-slate-300 font-semibold break-words">{detail.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                
              </div>
            <AnimatePresence>
              {isDocumentsSheetOpen && (
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white dark:bg-[#0a0a0a] border-l border-slate-100 dark:border-white/10 shadow-2xl z-[60] flex flex-col"
                >
                  <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-100 dark:border-white/10 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Documents</h3>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {displayHeaderName} - @{displayEmployee.id}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDocumentsSheetOpen(false)}
                      className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
                      aria-label="Close documents sheet"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto scrollbar-none px-6 py-5 space-y-3">
                    {(() => {
                      const documents = getEmployeeDocuments();

                      if (documents.length === 0) {
                        return (
                          <div className="flex items-start gap-3 p-3 rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5">
                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-400">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No attached documents</p>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{"\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23\u0e41\u0e19\u0e1a\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19\u0e04\u0e19\u0e19\u0e35\u0e49"}</p>
                            </div>
                          </div>
                        );
                      }

                      return documents.map((document) => (
                        <div key={document.id} className="p-4 rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-white/5">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400 shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1 text-[13px]">
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">{document.label}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">{document.name || "document"}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewAttachment(document.data, document.name)}
                              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-xs font-extrabold text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadDataUrl(document.data, document.name)}
                              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </button>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    
    <AnimatePresence>
      {confirmationDialog && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-md px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={() => closeConfirmation(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-confirmation-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121212] shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={cn(
              "h-2",
              confirmationDialog.tone === "danger"
                ? "bg-gradient-to-r from-rose-500 via-orange-400 to-amber-400"
                : "bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400"
            )} />
            <div className="p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                  confirmationDialog.tone === "danger"
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                    : "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
                )}>
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="employee-confirmation-title" className="text-lg font-extrabold leading-tight text-slate-900 dark:text-white">
                    {confirmationDialog.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {confirmationDialog.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => closeConfirmation(false)}
                  className="min-h-11 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  {confirmationDialog.cancelLabel || "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => closeConfirmation(true)}
                  className={cn(
                    "min-h-11 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white shadow-sm transition-all active:scale-95",
                    confirmationDialog.tone === "danger"
                      ? "bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600"
                      : "bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600"
                  )}
                >
                  {confirmationDialog.confirmLabel || "Confirm"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {displayEmployee && (
      <PassProbationModal
        isOpen={isPassProbationOpen}
        onClose={() => setIsPassProbationOpen(false)}
        employee={displayEmployee}
        onSave={handlePassProbationSave}
      />
    )}
    </>
  );
}
