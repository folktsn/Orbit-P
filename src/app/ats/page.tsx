"use client";

import { useState, useEffect } from "react";
import { Filter, Search, Loader2 } from "lucide-react";
import { Candidate } from "./types";
import { KanbanBoard } from "./components/KanbanBoard";
import { CandidateDrawer } from "./components/CandidateDrawer";

const columns = ["สมัครแล้ว", "คัดกรอง", "สัมภาษณ์", "จ้างงาน"];

export default function ATSPipeline() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Fetch candidates from database
  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/ats");
      const data = await res.json();
      if (data.success) {
        setCandidates(data.candidates);
      }
    } catch (err) {
      console.error("Failed to fetch candidates:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("candidateId", id);
  };

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("candidateId");
    
    // Optimistic Update
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );

    try {
      const res = await fetch("/api/ats", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!data.success) {
        // Revert if failed
        fetchCandidates();
      }
    } catch (err) {
      console.error("Failed to update candidate status:", err);
      fetchCandidates();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Filter candidates based on search
  const filteredCandidates = candidates.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recruitment Pipeline</h1>
          <p className="text-slate-400 mt-1">ระบบติดตามกระบวนการสรรหาบุคลากร (OrbitHire)</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 flex items-center gap-2 bg-white dark:bg-slate-800 shadow-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="ค้นหา..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-slate-900 dark:text-slate-100 text-sm w-48 placeholder:text-slate-400"
            />
          </div>
          <button className="border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors bg-white dark:bg-slate-800 shadow-sm text-slate-700 dark:text-slate-300">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">ตัวกรองอัจฉริยะ</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
            <p className="text-sm text-slate-400">กำลังโหลดผู้สมัครจาก OrbitHire...</p>
          </div>
        </div>
      ) : (
        <KanbanBoard 
          columns={columns} 
          candidates={filteredCandidates} 
          onDrop={handleDrop} 
          onDragStart={handleDragStart} 
          onDragOver={handleDragOver} 
          onSelectCandidate={setSelectedCandidate} 
        />
      )}

      <CandidateDrawer 
        selectedCandidate={selectedCandidate} 
        onClose={() => setSelectedCandidate(null)} 
      />
    </div>
  );
}
