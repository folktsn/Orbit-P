"use client";

import { useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Minus, Monitor, Moon, Plus, RotateCcw, SlidersHorizontal, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useDisplayPreferences } from "@/components/DisplayPreferencesProvider";
import { DEFAULT_DISPLAY_PREFERENCES, MAX_FONT_SCALE, MIN_FONT_SCALE } from "@/lib/display-preferences";
import "./ControlPanel.css";

export function ControlPanel({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreferences } = useDisplayPreferences();
  const sizeId = useId();
  const themeId = useId();
  const { fontScale, reduceMotion } = preferences;
  const isDefault = fontScale === 100 && !reduceMotion && (!theme || theme === "system");

  return (
    <Dialog.Root open={open} onOpenChange={value => { setOpen(value); if (value) onOpen(); }}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label="Control" title="Control" className="pill-action-button control-trigger">
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="control-overlay" />
        <Dialog.Content className="control-panel" aria-describedby={undefined}>
          <div className="control-heading">
            <Dialog.Title className="text-lg font-bold">Control</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="control-icon-button" aria-label="ปิด Control" title="ปิด Control"><X size={18} aria-hidden="true" /></button>
            </Dialog.Close>
          </div>

          <section className="control-section">
            <div className="control-row">
              <label htmlFor={sizeId} className="font-semibold">ขนาดตัวอักษร</label>
              <output htmlFor={sizeId} aria-live="polite" className="control-value">{fontScale}%</output>
            </div>
            <div className="control-size-input">
              <button type="button" className="control-icon-button" aria-label="ลดขนาดตัวอักษร" title="ลดขนาดตัวอักษร" disabled={fontScale <= MIN_FONT_SCALE} onClick={() => updatePreferences({ fontScale: fontScale - 10 })}><Minus size={18} aria-hidden="true" /></button>
              <input id={sizeId} type="range" min={MIN_FONT_SCALE} max={MAX_FONT_SCALE} step={10} value={fontScale} aria-valuetext={`${fontScale}%`} onChange={event => updatePreferences({ fontScale: Number(event.target.value) })} />
              <button type="button" className="control-icon-button" aria-label="เพิ่มขนาดตัวอักษร" title="เพิ่มขนาดตัวอักษร" disabled={fontScale >= MAX_FONT_SCALE} onClick={() => updatePreferences({ fontScale: fontScale + 10 })}><Plus size={18} aria-hidden="true" /></button>
            </div>
            <p className="control-preview" aria-hidden="true">Aa กข 123</p>
          </section>

          <section className="control-section">
            <fieldset className="control-theme-fieldset">
              <legend className="font-semibold">โหมดสี</legend>
              <div className="control-theme-options">
                {([{ value: "light", label: "สว่าง", Icon: Sun }, { value: "dark", label: "มืด", Icon: Moon }, { value: "system", label: "ระบบ", Icon: Monitor }] as const).map(({ value, label, Icon }) => (
                  <label key={value} className="control-theme-option">
                    <input type="radio" name={themeId} value={value} checked={(theme || "system") === value} onChange={() => setTheme(value)} />
                    <span><Icon size={16} aria-hidden="true" />{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <div className="control-section control-row">
            <span id={`${sizeId}-motion`} className="font-semibold">ลดการเคลื่อนไหว</span>
            <button type="button" role="switch" aria-checked={reduceMotion} aria-labelledby={`${sizeId}-motion`} className="control-switch" onClick={() => updatePreferences({ reduceMotion: !reduceMotion })}><span /></button>
          </div>

          <div className="control-footer">
            <button type="button" className="control-reset" disabled={isDefault} onClick={() => { updatePreferences(DEFAULT_DISPLAY_PREFERENCES); setTheme("system"); }}><RotateCcw size={16} aria-hidden="true" />คืนค่าเริ่มต้น</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
