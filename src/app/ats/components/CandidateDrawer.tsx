"use client";

import { motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Sparkles, Phone, Mail } from "lucide-react";
import { Candidate } from "../types";

interface CandidateDrawerProps {
  selectedCandidate: Candidate | null;
  onClose: () => void;
}

export function CandidateDrawer({ selectedCandidate, onClose }: CandidateDrawerProps) {
  return (
    <Dialog.Root open={!!selectedCandidate} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-[#0f172a] shadow-2xl z-50 overflow-y-auto">
          {selectedCandidate && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="h-full flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md z-10">
                <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-slate-100">ดูข้อมูลแบบย่อ</Dialog.Title>
                <Dialog.Close className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </Dialog.Close>
              </div>
              
              <div className="p-6 flex-1 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 flex items-center justify-center text-2xl font-bold">
                    {selectedCandidate.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedCandidate.name}</h2>
                    <p className="text-slate-500 dark:text-slate-400">{selectedCandidate.role}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button className="flex-1 flex items-center justify-center gap-2 bg-[#0F172A] dark:bg-blue-600 text-white rounded-xl font-semibold py-2 hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors shadow-sm">
                    <Mail className="w-4 h-4" /> อีเมล
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl font-semibold py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shadow-sm">
                    <Phone className="w-4 h-4" /> โทรศัพท์
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">การวิเคราะห์โดย AI</h3>
                  <div className="border border-purple-100 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/10 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-purple-900 dark:text-purple-100 flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" /> คะแนนความเหมาะสม</span>
                      <span className="text-xl font-bold text-purple-700 dark:text-purple-400">{selectedCandidate.score}%</span>
                    </div>
                    <p className="text-sm text-purple-800/80 dark:text-purple-300/80">ผู้สมัครมีความโดดเด่น ทักษะตรงกับความต้องการสูง แนะนำให้เข้าสู่รอบสัมภาษณ์ทันที</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">ทักษะและแท็ก</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.skills.map(skill => (
                      <span key={skill} className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
