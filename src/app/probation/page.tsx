"use client";

import { useState } from "react";
import { TrackerPanel } from "./components/TrackerPanel";
import { EvaluationForm } from "./components/EvaluationForm";

type EvaluationStep = 1 | 2 | 3;

export default function ProbationAutomation() {
  const [step, setStep] = useState<EvaluationStep>(1);
  const [selectedOutcome, setSelectedOutcome] = useState<"Pass" | "Fail" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleNext = () => {
    if (step < 3) setStep((prev) => (prev + 1) as EvaluationStep);
  };

  const handleProcessOutcome = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsCompleted(true);
    }, 2000);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Probation Tracker</h1>
        <p className="text-slate-400 mt-1">ระบบแจ้งเตือนและประเมินผลอัตโนมัติ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <TrackerPanel />
        <EvaluationForm 
          step={step}
          setStep={setStep}
          selectedOutcome={selectedOutcome}
          setSelectedOutcome={setSelectedOutcome}
          isProcessing={isProcessing}
          isCompleted={isCompleted}
          setIsCompleted={setIsCompleted}
          handleNext={handleNext}
          handleProcessOutcome={handleProcessOutcome}
        />
      </div>
    </div>
  );
}
