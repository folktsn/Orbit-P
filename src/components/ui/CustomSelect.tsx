"use client";

import { type CSSProperties, useState, useLayoutEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";

interface CustomSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
  triggerClassName?: string;
  portal?: boolean;
}

export function CustomSelect({ value, onChange, options, disabled = false, placeholder = "Select...", triggerClassName, portal = false }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuPosition, setMenuPosition] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  useLayoutEffect(() => {
    if (!portal || !isOpen || !triggerRef.current) return;
    // Portalled menus escape the independently scrolling filter panel.
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const opensAbove = below < 220 && above > below;
      const width = Math.min(rect.width, window.innerWidth - 16);
      setMenuPosition({
        position: "fixed", width,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: opensAbove ? undefined : rect.bottom + 4,
        bottom: opensAbove ? window.innerHeight - rect.top + 4 : undefined,
        maxHeight: Math.max(80, opensAbove ? above : below),
      });
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      updatePosition();
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(triggerRef.current);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [isOpen, portal]);

  const closeMenu = () => {
    setIsOpen(false);
    if (portal) triggerRef.current?.focus({ preventScroll: true });
  };

  const displayValue = value && value !== "-" && value !== "" ? value : placeholder;

  const dropdown = isOpen && (!portal || menuPosition) && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={closeMenu} />
          <div ref={menuRef} id={menuId} style={portal ? menuPosition ?? undefined : undefined}
            onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeMenu(); } }}
            className={`${portal ? "" : "absolute top-full left-0 mt-1 w-full"} bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-md shadow-xl z-[70] flex flex-col overflow-hidden`}>
            <div className="shrink-0 p-1 border-b border-slate-100 dark:border-white/5">
              <input 
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-[11px] lg:text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="min-h-0 max-h-40 overflow-y-auto overflow-x-hidden py-1">
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 text-[11px] lg:text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 truncate block"
                onClick={() => { onChange(""); closeMenu(); }}
              >
                {placeholder}
              </button>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-[11px] lg:text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 truncate block"
                    onClick={() => { onChange(opt); closeMenu(); }}
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
      );

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => { if (!disabled) { setSearch(""); setIsOpen(!isOpen); } }}
        disabled={disabled}
        className={`w-full text-left bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 text-[11px] lg:text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-white/20 truncate flex justify-between items-center ${triggerClassName || 'rounded-md px-2 py-1'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="truncate pr-2">{displayValue}</span>
        <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {dropdown && (portal ? createPortal(dropdown, document.body) : dropdown)}
    </div>
  );
}
