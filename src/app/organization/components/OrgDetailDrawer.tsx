"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Building2, Layers, Briefcase, Edit2, Save, Loader2, Trash2 } from "lucide-react";
import { TreeNode } from "./OrgChart";

interface OrgDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  node: TreeNode | null;
  onUpdate?: () => void;
  isEditMode?: boolean;
}

export function OrgDetailDrawer({ isOpen, onClose, node, onUpdate, isEditMode = false }: OrgDetailDrawerProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  if (!node) return null;

  const startEditing = (item: any) => {
    setEditingItemId(item.id);
    setEditForm({ ...item });
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditForm({});
  };

  const handleChange = (field: string, value: string) => {
    setEditForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (id: string) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/organization/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      
      if (res.ok) {
        setEditingItemId(null);
        // Mutate local node data for immediate UI update without reload
        if (node && node.data) {
          const index = node.data.findIndex((i: any) => i.id === id);
          if (index !== -1) {
            node.data[index] = { ...node.data[index], ...editForm };
          }
        }
        if (onUpdate) onUpdate();
      } else {
        const errorData = await res.json();
        alert(`Failed to update: ${errorData.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error saving data");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this position?")) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/organization/update?id=${id}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        // Mutate local node data for immediate UI update without reload
        if (node && node.data) {
          node.data = node.data.filter((i: any) => i.id !== id);
        }
        if (onUpdate) onUpdate();
      } else {
        const errorData = await res.json();
        alert(`Failed to delete: ${errorData.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting position");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-[#0A0A0A] shadow-2xl border-l border-slate-200 dark:border-white/10 z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#121212]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  {node.type === 'department' ? <Building2 className="w-5 h-5" /> :
                   node.type === 'division' ? <Layers className="w-5 h-5" /> :
                   <Users className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="font-bold text-lg text-slate-900 dark:text-white capitalize">{node.type} Details</h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Profile Card Summary */}
              <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{node.label}</h3>
                {node.subLabel && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{node.subLabel}</p>}
                
                <div className="mt-4 flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {node.count} Positions Total
                  </span>
                </div>
              </div>

              {/* Positions List */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  Positions in this {node.type}
                </h4>
                
                <div className="space-y-3">
                  {node.data.map((item, idx) => {
                    const isEditing = editingItemId === item.id;

                    if (isEditing) {
                      return (
                        <div key={item.id} className="bg-white dark:bg-[#1A1A1A] border-2 border-blue-500 rounded-xl p-4 shadow-md space-y-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Editing Position</span>
                            <div className="flex gap-2">
                              <button onClick={cancelEditing} disabled={isSaving} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            {/* Position */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Position (EN)</label>
                                <input type="text" value={editForm.position_en || ""} onChange={e => handleChange("position_en", e.target.value)} className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Position (TH)</label>
                                <input type="text" value={editForm.position_th || ""} onChange={e => handleChange("position_th", e.target.value)} className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                            </div>

                            {/* Department */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Department (EN)</label>
                                <input type="text" value={editForm.department_en || ""} onChange={e => handleChange("department_en", e.target.value)} className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Department (TH)</label>
                                <input type="text" value={editForm.department_th || ""} onChange={e => handleChange("department_th", e.target.value)} className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                            </div>

                            {/* Division */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Division (EN)</label>
                                <input type="text" value={editForm.division_en || ""} onChange={e => handleChange("division_en", e.target.value)} className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Division (TH)</label>
                                <input type="text" value={editForm.division_th || ""} onChange={e => handleChange("division_th", e.target.value)} className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                            </div>

                            {/* Section */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Section (EN)</label>
                                <input type="text" value={editForm.section_en || ""} onChange={e => handleChange("section_en", e.target.value)} className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Section (TH)</label>
                                <input type="text" value={editForm.section_th || ""} onChange={e => handleChange("section_th", e.target.value)} className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                            </div>

                            {/* Unit */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Unit (EN)</label>
                                <input type="text" value={editForm.unit_en || ""} onChange={e => handleChange("unit_en", e.target.value)} className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Unit (TH)</label>
                                <input type="text" value={editForm.unit_th || ""} onChange={e => handleChange("unit_th", e.target.value)} className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                            </div>

                            {/* Station */}
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Station</label>
                                <input type="text" value={editForm.station || ""} onChange={e => handleChange("station", e.target.value)} className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>

                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex justify-end gap-2">
                            <button onClick={cancelEditing} disabled={isSaving} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 rounded transition-colors disabled:opacity-50">Cancel</button>
                            <button onClick={() => handleSave(item.id)} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors disabled:opacity-50">
                              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={item.id || idx} className="group bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              {item.position_en !== "-" ? item.position_en : item.position_th}
                            </p>
                            {item.position_th && item.position_th !== "-" && item.position_en !== "-" && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.position_th}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2 z-10">
                            {isEditMode && (
                              <button 
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(item.id); }}
                                className="p-1.5 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-md text-slate-400 hover:text-rose-600 shadow-sm transition-colors"
                                title="Delete Position"
                                disabled={isSaving}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(item); }}
                              className="p-1.5 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-md text-slate-400 hover:text-blue-500 shadow-sm transition-colors"
                              title="Edit Position"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mt-2">
                          {item.section_en !== "-" && (
                            <span className="text-[10px] px-2 py-0.5 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 rounded">
                              {item.section_en}
                            </span>
                          )}
                          {item.unit_en !== "-" && (
                            <span className="text-[10px] px-2 py-0.5 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 rounded">
                              {item.unit_en}
                            </span>
                          )}
                          {item.station !== "-" && (
                            <span className="text-[10px] font-medium px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded">
                              Station: {item.station}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
