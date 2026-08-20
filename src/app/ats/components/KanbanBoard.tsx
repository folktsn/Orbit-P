"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Candidate } from "../types";

interface KanbanBoardProps {
  columns: string[];
  candidates: Candidate[];
  onDrop: (e: React.DragEvent, status: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onSelectCandidate: (candidate: Candidate) => void;
}

export function KanbanBoard({
  columns,
  candidates,
  onDrop,
  onDragStart,
  onDragOver,
  onSelectCandidate,
}: KanbanBoardProps) {
  return (
    <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div 
          key={col} 
          className="w-80 flex-shrink-0 flex flex-col"
          onDrop={(e) => onDrop(e, col)}
          onDragOver={onDragOver}
        >
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300">{col}</h3>
            <span className="text-xs font-bold bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-400">
              {candidates.filter(c => c.status === col).length}
            </span>
          </div>
          
          <div className="flex-1 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 flex flex-col gap-4 overflow-y-auto min-h-[200px]">
            <AnimatePresence>
              {candidates
                .filter((c) => c.status === col)
                .map((candidate) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    key={candidate.id}
                    draggable
                    onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, candidate.id)}
                    onClick={() => onSelectCandidate(candidate)}
                    className="bg-white dark:bg-[#1e293b] border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">{candidate.name}</h4>
                      <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full px-2 py-0.5 text-xs font-bold">
                        <Sparkles className="w-3 h-3" />
                        {candidate.score}
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{candidate.role}</p>
                    <div className="flex flex-wrap gap-2">
                      {candidate.skills.map(skill => (
                        <span key={skill} className="text-[10px] uppercase tracking-wider font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </div>
      ))}
    </div>
  );
}
