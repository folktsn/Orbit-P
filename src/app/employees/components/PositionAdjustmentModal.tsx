"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Calendar, Loader2 } from "lucide-react";
import { EmployeeData } from "./EmployeeProfileDrawer";
import { OrgData } from "../../organization/components/OrgChart";
import { CustomSelect } from "@/components/ui/CustomSelect";

// Reuse the CustomSelect from EmployeeProfileDrawer

interface PositionAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeData;
  orgData: OrgData[];
  title?: string;
  onSave: (adjustmentData: any) => Promise<void>;
}

export function PositionAdjustmentModal({ isOpen, onClose, employee, orgData, title = "Position Adjustment", onSave }: PositionAdjustmentModalProps) {
  const [formData, setFormData] = useState({
    department: "-",
    division: "-",
    section: "-",
    unit: "-",
    position: "-",
    effectiveDate: ""
  });
  const [isSaving, setIsSaving] = useState(false);

  // Formatting helpers
  const formatWithCode = (name: string, code: string) => {
    if (!name || name === "-") return "-";
    if (code && code !== "-") return `${name} (${code})`;
    return name;
  };

  // Cascading logic
  const departments = useMemo(() => {
    return Array.from(new Set(orgData.map(item => formatWithCode(item.department_en, item.department_code)).filter(v => v !== "-")));
  }, [orgData]);

  const divisions = useMemo(() => {
    if (!formData.department || formData.department === "-") return [];
    return Array.from(new Set(orgData
      .filter(item => formatWithCode(item.department_en, item.department_code) === formData.department)
      .map(item => formatWithCode(item.division_en, item.division_code))
      .filter(v => v !== "-")
    ));
  }, [orgData, formData.department]);

  const sections = useMemo(() => {
    if (!formData.division || formData.division === "-") return [];
    return Array.from(new Set(orgData
      .filter(item => formatWithCode(item.department_en, item.department_code) === formData.department && 
                      formatWithCode(item.division_en, item.division_code) === formData.division)
      .map(item => formatWithCode(item.section_en, item.section_code))
      .filter(v => v !== "-")
    ));
  }, [orgData, formData.department, formData.division]);

  const units = useMemo(() => {
    if (!formData.section || formData.section === "-") return [];
    return Array.from(new Set(orgData
      .filter(item => formatWithCode(item.department_en, item.department_code) === formData.department && 
                      formatWithCode(item.division_en, item.division_code) === formData.division && 
                      formatWithCode(item.section_en, item.section_code) === formData.section)
      .map(item => formatWithCode(item.unit_en, item.unit_code))
      .filter(v => v !== "-")
    ));
  }, [orgData, formData.department, formData.division, formData.section]);

  const positions = useMemo(() => {
    let filtered = orgData;
    if (formData.department && formData.department !== "-") {
      filtered = filtered.filter(item => formatWithCode(item.department_en, item.department_code) === formData.department);
    }
    if (formData.division && formData.division !== "-") {
      filtered = filtered.filter(item => formatWithCode(item.division_en, item.division_code) === formData.division);
    }
    if (formData.section && formData.section !== "-") {
      filtered = filtered.filter(item => formatWithCode(item.section_en, item.section_code) === formData.section);
    }
    if (formData.unit && formData.unit !== "-") {
      filtered = filtered.filter(item => formatWithCode(item.unit_en, item.unit_code) === formData.unit);
    }
    return Array.from(new Set(filtered.map(item => item.position_en).filter(v => v && v !== "-")));
  }, [orgData, formData.department, formData.division, formData.section, formData.unit]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'department') {
        next.division = "-"; next.section = "-"; next.unit = "-"; next.position = "-";
      }
      if (field === 'division') {
        next.section = "-"; next.unit = "-"; next.position = "-";
      }
      if (field === 'section') {
        next.unit = "-"; next.position = "-";
      }
      if (field === 'unit') {
        next.position = "-";
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!formData.effectiveDate || formData.position === "-") {
      alert("Please select a target position and effective date.");
      return;
    }
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (e) {
      console.error(e);
      alert("Error saving adjustment");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[70] overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-white/5">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Schedule {title.toLowerCase()} for {employee.nameEn || employee.name}</p>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">Department</span>
                <CustomSelect value={formData.department} onChange={(v) => handleChange('department', v)} options={departments} />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">Division</span>
                <CustomSelect value={formData.division} onChange={(v) => handleChange('division', v)} options={divisions} disabled={formData.department === "-"} />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">Section</span>
                <CustomSelect value={formData.section} onChange={(v) => handleChange('section', v)} options={sections} disabled={formData.division === "-"} />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">Unit</span>
                <CustomSelect value={formData.unit} onChange={(v) => handleChange('unit', v)} options={units} disabled={formData.section === "-"} />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">Target Position</span>
                <CustomSelect value={formData.position} onChange={(v) => handleChange('position', v)} options={positions} disabled={formData.department === "-"} />
              </div>
              
              <div className="pt-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">Effective Date</span>
                <div className="relative">
                  <input 
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => handleChange('effectiveDate', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/20 flex justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isSaving || !formData.effectiveDate || formData.position === "-"}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Schedule Update
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
