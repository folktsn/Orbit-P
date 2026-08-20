"use client";

import { useState, useEffect } from "react";

interface CustomSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
  triggerClassName?: string;
}

export function CustomSelect({ value, onChange, options, disabled = false, placeholder = "Select...", triggerClassName }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!isOpen) setSearch("");
  }, [isOpen]);

  const displayValue = value && value !== "-" && value !== "" ? value : placeholder;

  return (
    <div className="relative w-full">
      <button 
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full text-left bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 text-[11px] lg:text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-white/20 truncate flex justify-between items-center ${triggerClassName || 'rounded-md px-2 py-1'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="truncate pr-2">{displayValue}</span>
        <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-md shadow-xl z-[70] flex flex-col">
            <div className="p-1 border-b border-slate-100 dark:border-white/5">
              <input 
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-[11px] lg:text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-40 overflow-y-auto overflow-x-hidden py-1">
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 text-[11px] lg:text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 truncate block"
                onClick={() => { onChange(""); setIsOpen(false); }}
              >
                {placeholder}
              </button>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-[11px] lg:text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 truncate block"
                    onClick={() => { onChange(opt); setIsOpen(false); }}
                    title={opt}
                  >
                    {opt}
                  </button>
                ))
              ) : (
                <div className="px-2 py-1.5 text-[11px] lg:text-sm text-slate-400 italic">No results</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
