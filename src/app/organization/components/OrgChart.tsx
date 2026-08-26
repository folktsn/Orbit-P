"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Layers, Users, Minus, Plus, Briefcase, UserRound, Search, X, Send, Download, Printer, Palette, Sliders, RefreshCw } from "lucide-react";
import { OrgDetailDrawer } from "./OrgDetailDrawer";
import { cn } from "@/lib/utils";

const themeColors = {
  emerald: { line: "#10b981", card: "bg-[#0b91a1]", hover: "hover:bg-[#097b89]", badgeBg: "bg-slate-100", badgeText: "text-slate-800", ring: "ring-emerald-500" },
  ocean: { line: "#0ea5e9", card: "bg-[#0284c7]", hover: "hover:bg-[#0369a1]", badgeBg: "bg-sky-50", badgeText: "text-sky-900", ring: "ring-sky-500" },
  sunset: { line: "#f97316", card: "bg-[#ea580c]", hover: "hover:bg-[#c2410c]", badgeBg: "bg-orange-50", badgeText: "text-orange-950", ring: "ring-orange-500" },
  grape: { line: "#8b5cf6", card: "bg-[#7c3aed]", hover: "hover:bg-[#6d28d9]", badgeBg: "bg-violet-50", badgeText: "text-violet-950", ring: "ring-violet-500" },
  slate: { line: "#64748b", card: "bg-[#475569]", hover: "hover:bg-[#334155]", badgeBg: "bg-slate-100", badgeText: "text-slate-900", ring: "ring-slate-500" }
};

export interface OrgData {
  id: string;
  department_code: string;
  department_en: string;
  department_th: string;
  division_code: string;
  division_en: string;
  division_th: string;
  section_code: string;
  section_en: string;
  section_th: string;
  unit_code: string;
  unit_en: string;
  unit_th: string;
  position_en: string;
  position_th: string;
  station: string;
  layout_x?: string;
  layout_y?: string;
}

export interface TreeNode {
  id: string;
  type: "root" | "department" | "division" | "station" | "section" | "unit";
  code?: string;
  label: string;
  subLabel?: string;
  children: TreeNode[];
  count: number;
  data: OrgData[];
  x?: number;
  y?: number;
}

interface CanvasConnection {
  id: string;
  fromId: string;
  toId: string;
}

const flattenTree = (node: TreeNode, parentNode?: TreeNode) => {
  let nodes: TreeNode[] = [node];
  let connections: CanvasConnection[] = [];
  
  if (parentNode) {
    connections.push({
      id: `conn-${parentNode.id}-${node.id}`,
      fromId: parentNode.id,
      toId: node.id
    });
  }
  
  node.children.forEach(child => {
    const childData = flattenTree(child, node);
    nodes = [...nodes, ...childData.nodes];
    connections = [...connections, ...childData.connections];
  });
  
  return { nodes, connections };
};

const computeDefaultLayout = (root: TreeNode) => {
  const layouts: Record<string, { x: number, y: number }> = {};
  const subtreeWidths: Record<string, number> = {};
  
  const calculateWidth = (node: TreeNode): number => {
    // If a node is vertical parent or child, its horizontal slot width is 1
    if (node.type !== 'root' && node.type !== 'department') {
      subtreeWidths[node.id] = 1;
      return 1;
    }
    if (node.children.length === 0) {
      subtreeWidths[node.id] = 1;
      return 1;
    }
    const width = node.children.reduce((sum, child) => sum + calculateWidth(child), 0);
    subtreeWidths[node.id] = width;
    return width;
  };
  calculateWidth(root);
  
  const calculateHeight = (node: TreeNode): number => {
    if (node.children.length === 0) {
      return 1;
    }
    return 1 + node.children.reduce((sum, child) => sum + calculateHeight(child), 0);
  };
  
  const verticalSpacing = 220;   // Pixels between standard levels
  const horizontalSpacing = 300;  // Base space unit for standard columns
  const horizontalShift = 150;    // Horizontal shift for stacked children
  const stackSpacing = 85;        // Vertical space unit for stacked children
  
  const positionNode = (node: TreeNode, x: number, y: number) => {
    layouts[node.id] = { x, y };
    
    if (node.children.length > 0) {
      if (node.type === 'root' || node.type === 'department') {
        // Horizontal layout for root/department children
        const totalWidth = subtreeWidths[node.id];
        let currentX = x - (totalWidth * horizontalSpacing) / 2;
        
        node.children.forEach(child => {
          const childWidth = subtreeWidths[child.id];
          const childX = currentX + (childWidth * horizontalSpacing) / 2;
          positionNode(child, childX, y + verticalSpacing);
          currentX += childWidth * horizontalSpacing;
        });
      } else {
        // Vertical layout (stacking) for division and below children
        let currentY = y + 85;
        node.children.forEach(child => {
          positionNode(child, x + horizontalShift, currentY);
          const childHeight = calculateHeight(child);
          currentY += childHeight * stackSpacing;
        });
      }
    }
  };
  
  positionNode(root, 2000, 150);
  return layouts;
};

const resolveNodePositions = (nodes: TreeNode[], defaultLayout: Record<string, { x: number, y: number }>) => {
  const positions: Record<string, { x: number, y: number }> = {};
  
  nodes.forEach(node => {
    const sample = node.data && node.data.length > 0 ? node.data[0] : null;
    const customX = sample?.layout_x && sample?.layout_x !== "-" ? parseFloat(sample.layout_x) : null;
    const customY = sample?.layout_y && sample?.layout_y !== "-" ? parseFloat(sample.layout_y) : null;
    
    if (customX !== null && !isNaN(customX) && customY !== null && !isNaN(customY)) {
      positions[node.id] = { x: customX, y: customY };
    } else {
      positions[node.id] = defaultLayout[node.id] || { x: 2000, y: 150 };
    }
  });
  
  return positions;
};

const getBezierPath = (
  fromX: number, 
  fromY: number, 
  toX: number, 
  toY: number, 
  lineRadius: string = '0px',
  cardMode: 'detailed' | 'compact' | 'minimal' = 'detailed'
) => {
  const halfH = cardMode === 'minimal' ? 16 : cardMode === 'compact' ? 22 : 24;
  const startX = fromX;
  const startY = fromY + halfH; // Bottom of card
  const endX = toX;
  const endY = toY - halfH; // Top of card
  
  if (lineRadius === '0px') {
    const midY = startY + (endY - startY) / 2;
    return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
  } else {
    // Smooth Bezier path
    const midY = startY + (endY - startY) / 2;
    return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
  }
};

const isValidParent = (nodeType: string, parentType: string) => {
  if (nodeType === 'division') return parentType === 'department';
  if (nodeType === 'station') return parentType === 'division' || parentType === 'department';
  if (nodeType === 'section') return parentType === 'station' || parentType === 'division' || parentType === 'department';
  if (nodeType === 'unit') return parentType === 'section' || parentType === 'station' || parentType === 'division' || parentType === 'department';
  if (nodeType === 'department') return parentType === 'root';
  return false;
};

const groupBy = (array: any[], key: string) => {
  return array.reduce((result, currentValue) => {
    const groupKey = currentValue[key] || "Unknown";
    (result[groupKey] = result[groupKey] || []).push(currentValue);
    return result;
  }, {});
};

const getPositionPriority = (posEn: string, posTh: string) => {
  const p = (posEn || "").toLowerCase() + " " + (posTh || "").toLowerCase();
  if (p.includes("director") || p.includes("ผอ.") || p.includes("ผู้อำนวยการ")) return 1;
  if (p.includes("manager") || p.includes("ผู้จัดการ")) return 2;
  if (p.includes("supervisor") || p.includes("หัวหน้า")) return 3;
  if (p.includes("officer") || p.includes("agent") || p.includes("เจ้าหน้าที่")) return 4;
  if (p.includes("staff") || p.includes("พนักงาน")) return 5;
  return 6;
};

const sortItems = (items: OrgData[]) => {
  return [...items].sort((a, b) => {
    return getPositionPriority(a.position_en, a.position_th) - getPositionPriority(b.position_en, b.position_th);
  });
};

const bhCodePriority: Record<string, number> = {
  // Divisions
  'HM': 1,
  'HO': 2,
  'HW': 3,
  'HD': 4,
  'HC': 5,
  // HM Sections
  'HM-S': 10,
  'HM-E': 11,
  'HM-I': 12,
  'HM-P': 13,
  // HO Sections
  'HO-R': 20,
  'HO-E': 21,
  'HO-B': 22,
  // HW Sections
  'HW-G': 30,
  'HW-U': 31,
  'HW-E': 32,
  // HD Sections
  'HD-S': 40,
  'HD-D': 41,
};

const buildTree = (data: OrgData[]): TreeNode => {
  const ceoItems = data.filter((item: OrgData) => {
    const posEn = item.position_en?.toLowerCase() || '';
    const posTh = item.position_th?.toLowerCase() || '';
    return posEn.includes('ceo') || posEn.includes('chief') || posTh.includes('ประธานเจ้าหน้าที่บริหาร');
  });

  const root: TreeNode = { 
    id: 'root', type: 'root', code: 'CEO', 
    label: 'ประธานเจ้าหน้าที่บริหาร', subLabel: 'Chief Executive Officer', 
    children: [], count: ceoItems.length, data: sortItems(ceoItems) 
  };
  
  const depts = groupBy(data, 'department_en');
  Object.keys(depts).forEach(deptName => {
    if (!deptName || deptName === "-") return;
    
    const deptItems = depts[deptName];
    const deptTh = deptItems[0].department_th !== "-" ? deptItems[0].department_th : deptName;
    const directorItems = deptItems.filter((item: OrgData) => {
      const posEn = item.position_en?.toLowerCase() || '';
      const posTh = item.position_th?.toLowerCase() || '';
      return posEn.includes('director') || posTh.includes('ผู้อำนวยการ') || posTh.includes('ผอ.');
    });

    const sortedDirItems = sortItems(directorItems);

    const deptNode: TreeNode = { 
      id: `dept-${deptName}`, type: 'department', 
      code: deptItems[0].department_code && deptItems[0].department_code !== "-" ? deptItems[0].department_code : 'DP',
      label: deptTh, 
      subLabel: deptName !== "-" ? deptName : undefined,
      children: [], 
      count: sortedDirItems.length, 
      data: sortedDirItems 
    };
    
    const divs = groupBy(deptItems, 'division_en');
    Object.keys(divs).forEach(divName => {
      const divItems = divs[divName];
      let parentForStation = deptNode;
      
      if (divName && divName !== "-") {
        const divTh = divItems[0].division_th !== "-" ? divItems[0].division_th : divName;
        
        // Direct Division Items: only items that have NO station (or HDQ), NO section, NO unit, and are NOT directors (directors are at dept level)
        const directDivItems = divItems.filter((item: OrgData) => 
          (!item.station || item.station === "-" || item.station === "HDQ") && 
          (!item.section_en || item.section_en === "-") && 
          (!item.unit_en || item.unit_en === "-") &&
          !directorItems.includes(item)
        );
        const sortedDivItems = sortItems(directDivItems);

        const divNode: TreeNode = {
          id: `div-${deptName}-${divName}`, type: 'division',
          code: divItems[0].division_code && divItems[0].division_code !== "-" ? divItems[0].division_code : 'DV',
          label: divTh,
          subLabel: divName !== "-" ? divName : undefined,
          children: [], 
          count: sortedDivItems.length, 
          data: sortedDivItems
        };
        deptNode.children.push(divNode);
        parentForStation = divNode;
      }
      
      const stations = groupBy(divItems, 'station');
      Object.keys(stations).forEach(stationName => {
        const stationItems = stations[stationName];
        let parentForSec = parentForStation;
        
        if (stationName && stationName !== "-" && stationName !== "HDQ") {
          // Direct Station Items: only items that have NO section and NO unit
          const directStationItems = stationItems.filter((item: OrgData) => 
            (!item.section_en || item.section_en === "-") && 
            (!item.unit_en || item.unit_en === "-") &&
            !directorItems.includes(item)
          );
          const sortedStationItems = sortItems(directStationItems);

          const stationNode: TreeNode = {
            id: `sta-${deptName}-${divName}-${stationName}`, 
            type: 'station',
            code: stationName,
            label: `สถานี ${stationName}`,
            subLabel: `${stationName} Station`,
            children: [], 
            count: sortedStationItems.length, 
            data: sortedStationItems
          };
          parentForStation.children.push(stationNode);
          parentForSec = stationNode;
        }
        
        const secs = groupBy(stationItems, 'section_en');
        Object.keys(secs).forEach(secName => {
          const secItems = secs[secName];
          let parentForUnit = parentForSec;
          
          if (secName && secName !== "-") {
            const secTh = secItems[0].section_th !== "-" ? secItems[0].section_th : secName;
            
            // Direct Section Items: only items that have NO unit
            const directSecItems = secItems.filter((item: OrgData) => 
              (!item.unit_en || item.unit_en === "-") &&
              !directorItems.includes(item)
            );
            const sortedSecItems = sortItems(directSecItems);

            const secNode: TreeNode = {
              id: `sec-${deptName}-${divName}-${stationName}-${secName}`, type: 'section',
              code: secItems[0].section_code && secItems[0].section_code !== "-" ? secItems[0].section_code : 'SC',
              label: secTh,
              subLabel: secName !== "-" ? secName : undefined,
              children: [], 
              count: sortedSecItems.length, 
              data: sortedSecItems
            };
            parentForSec.children.push(secNode);
            parentForUnit = secNode;
          }
          
          const units = groupBy(secItems, 'unit_en');
          Object.keys(units).forEach(unitName => {
            const unitItems = units[unitName];
            if (unitName && unitName !== "-") {
              const unitTh = unitItems[0].unit_th !== "-" ? unitItems[0].unit_th : unitName;
              
              const directUnitItems = unitItems.filter((item: OrgData) => !directorItems.includes(item));
              const sortedUnitItems = sortItems(directUnitItems);

              parentForUnit.children.push({
                id: `unit-${deptName}-${divName}-${stationName}-${secName}-${unitName}`, type: 'unit',
                code: unitItems[0].unit_code && unitItems[0].unit_code !== "-" ? unitItems[0].unit_code : 'UN',
                label: unitTh,
                subLabel: unitName !== "-" ? unitName : undefined,
                children: [], 
                count: sortedUnitItems.length, 
                data: sortedUnitItems
              });
            }
          });
        });
      });
    });
    root.children.push(deptNode);
  });

  // Inject Vice President under CEO root node
  const vpItems = data.filter((item: OrgData) => {
    const posEn = item.position_en?.toLowerCase() || '';
    const posTh = item.position_th?.toLowerCase() || '';
    return (posEn.includes('vice president') || posEn === 'vp' || posTh.includes('รองประธาน')) &&
           (!item.department_code || item.department_code === "-" || item.department_en === "-");
  });

  if (vpItems.length > 0) {
    root.children.push({
      id: 'dept-VP', 
      type: 'department', 
      code: 'VP',
      label: vpItems[0].position_th || 'รองประธานกรรมการ สายงานทรัพยากรบุคคล', 
      subLabel: vpItems[0].position_en || 'Vice President - Human Resources',
      children: [], 
      count: vpItems.length, 
      data: sortItems(vpItems)
    });
  }
  
  const sortTreeNodes = (node: TreeNode) => {
    if (node.children && node.children.length > 0) {
      node.children.sort((a, b) => {
        const codeA = a.code || "";
        const codeB = b.code || "";
        
        const prioA = bhCodePriority[codeA];
        const prioB = bhCodePriority[codeB];
        
        if (prioA !== undefined && prioB !== undefined) {
          return prioA - prioB;
        }
        if (prioA !== undefined) return -1;
        if (prioB !== undefined) return 1;
        
        if (codeA !== codeB) return codeA.localeCompare(codeB);
        
        const labelA = a.subLabel || a.label || "";
        const labelB = b.subLabel || b.label || "";
        return labelA.localeCompare(labelB);
      });
      node.children.forEach(sortTreeNodes);
    }
  };
  
  sortTreeNodes(root);
  return root;
};

const NodeCard = ({ 
  node, 
  isExpanded, 
  onToggle, 
  onClick, 
  isEditMode, 
  onAddClick,
  layout,
  cardMode,
  themeConfig,
  isFreeLayout = false,
  isNodeDragging = false,
  isHoveredTarget = false,
  onDragStart,
  onDragMove,
  onDragEnd
}: { 
  node: TreeNode, 
  isExpanded: boolean, 
  onToggle: () => void, 
  onClick: () => void, 
  isEditMode: boolean, 
  onAddClick: (node: TreeNode) => void,
  layout: 'vertical' | 'horizontal',
  cardMode: 'detailed' | 'compact' | 'minimal',
  themeConfig: any,
  isFreeLayout?: boolean,
  isNodeDragging?: boolean,
  isHoveredTarget?: boolean,
  onDragStart?: (e: React.PointerEvent) => void,
  onDragMove?: (e: React.PointerEvent) => void,
  onDragEnd?: (e: React.PointerEvent) => void
}) => {
  const isRoot = node.type === 'root';
  const isHorizontal = layout === 'horizontal';
  const isMinimal = cardMode === 'minimal';
  const isCompact = cardMode === 'compact';

  // Premium node type styling matching PDF diagram
  const customStyles = (() => {
    switch (node.type) {
      case 'root':
        return {
          card: "bg-gradient-to-r from-[#DFB15B] to-[#F1C774] dark:from-[#c5963c] dark:to-[#e2b55b] border border-[#C5963C] dark:border-amber-400/30 text-slate-900 shadow-md",
          hover: "hover:scale-[1.03] hover:shadow-lg hover:shadow-amber-500/10",
          text: "text-slate-950 font-bold",
          badgeBg: "bg-amber-100/90 border-[#A07B30]",
          badgeText: "text-amber-950",
          ring: "ring-amber-500",
          countText: "text-amber-900"
        };
      case 'department':
        if (node.id === 'dept-VP') {
          return {
            card: "bg-gradient-to-r from-[#EEDAA2] to-[#F7E7C4] dark:from-[#cbb173] dark:to-[#dfca97] border border-[#DFB15B] dark:border-amber-400/20 text-slate-900 shadow-md",
            hover: "hover:scale-[1.03] hover:shadow-lg hover:shadow-amber-500/10",
            text: "text-slate-950 font-bold",
            badgeBg: "bg-amber-100/90 border-[#C5963C]",
            badgeText: "text-[#8A671C]",
            ring: "ring-amber-500",
            countText: "text-amber-900"
          };
        }
        return {
          card: "bg-gradient-to-r from-[#B9DCF4] to-[#D7EBF8] dark:from-[#2c5370] dark:to-[#3e6887] border border-[#76B0D8] dark:border-sky-500/30 text-slate-900 dark:text-white shadow-md",
          hover: "hover:scale-[1.03] hover:shadow-lg hover:shadow-sky-500/10",
          text: "text-slate-950 dark:text-white font-bold",
          badgeBg: "bg-sky-100/90 border-[#5A97C2]",
          badgeText: "text-[#1C4E75]",
          ring: "ring-sky-500",
          countText: "text-[#1C4E75] dark:text-sky-200"
        };
      case 'division':
        return {
          card: "bg-gradient-to-r from-[#C2EBC5] to-[#DCF5DE] dark:from-[#2e5d33] dark:to-[#3e7244] border border-[#7FC284] dark:border-emerald-500/20 text-slate-900 dark:text-white shadow-md",
          hover: "hover:scale-[1.03] hover:shadow-lg hover:shadow-emerald-500/10",
          text: "text-slate-950 dark:text-white font-bold",
          badgeBg: "bg-emerald-100/90 border-[#5CA562]",
          badgeText: "text-[#225C26]",
          ring: "ring-emerald-500",
          countText: "text-[#225C26] dark:text-emerald-200"
        };
      case 'station':
        return {
          card: "bg-gradient-to-r from-cyan-600/90 to-blue-500/90 border border-cyan-700 dark:border-cyan-500/20 text-white shadow-md",
          hover: "hover:scale-[1.03] hover:shadow-lg hover:shadow-cyan-500/10",
          text: "text-white font-bold",
          badgeBg: "bg-cyan-100 border-cyan-700",
          badgeText: "text-cyan-950",
          ring: "ring-cyan-500",
          countText: "text-cyan-200"
        };
      case 'section':
        return {
          card: "bg-gradient-to-r from-[#F7EFCF] to-[#FCF8E8] dark:from-[#4b432a] dark:to-[#5e5539] border border-[#DFCE92] dark:border-amber-700/30 text-slate-800 dark:text-slate-200 shadow-sm",
          hover: "hover:scale-[1.03] hover:shadow-md hover:shadow-amber-500/5",
          text: "text-[#6B551C] dark:text-amber-100 font-semibold",
          badgeBg: "bg-amber-100/90 border-[#C5B374] dark:bg-amber-900 dark:border-amber-700/50",
          badgeText: "text-[#6B551C] dark:text-amber-100",
          ring: "ring-amber-500",
          countText: "text-[#806B33] dark:text-amber-300"
        };
      case 'unit':
        return {
          card: "bg-gradient-to-r from-[#EEDCF6] to-[#F8EFFC] dark:from-[#3f2a4a] dark:to-[#52395d] border border-[#CDA2DF] dark:border-purple-700/30 text-slate-800 dark:text-slate-200 shadow-sm",
          hover: "hover:scale-[1.03] hover:shadow-md hover:shadow-purple-500/5",
          text: "text-[#5D1F7A] dark:text-purple-100 font-semibold",
          badgeBg: "bg-purple-100/90 border-[#B77FCF] dark:bg-purple-900 dark:border-purple-700/50",
          badgeText: "text-[#5D1F7A] dark:text-purple-100",
          ring: "ring-purple-500",
          countText: "text-[#753493] dark:text-purple-300"
        };
      default:
        return {
          card: themeConfig.card,
          hover: themeConfig.hover,
          text: "text-white font-medium",
          badgeBg: themeConfig.badgeBg,
          badgeText: themeConfig.badgeText,
          ring: themeConfig.ring,
          countText: "text-teal-100/90"
        };
    }
  })();

  return (
    <div className={cn(
      "relative flex items-center justify-center",
      isHorizontal ? "flex-row py-1 px-4" : "flex-col py-2"
    )}>
      {/* Connector Circle (Top/Left) */}
      {!isRoot && (
        <div 
          className={cn(
            "absolute rounded-full border-[2.5px] bg-white z-10 transition-all",
            isHorizontal 
              ? "top-1/2 -translate-y-1/2 left-0 w-3 h-3" 
              : "-top-[5px] left-1/2 -translate-x-1/2 w-3.5 h-3.5"
          )}
          style={{ borderColor: "var(--line-color)" }}
        />
      )}
      
      <div 
        onClick={onClick}
        onPointerDown={isFreeLayout && isEditMode ? onDragStart : undefined}
        onPointerMove={isFreeLayout && isEditMode ? onDragMove : undefined}
        onPointerUp={isFreeLayout && isEditMode ? onDragEnd : undefined}
        className={cn(
          "relative flex items-center rounded-full shadow-md cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-300",
          customStyles.card,
          customStyles.hover,
          isMinimal 
            ? "h-8 px-4 min-w-[140px] max-w-[200px]" 
            : isCompact 
              ? "h-11 pl-12 pr-5 min-w-[190px] max-w-[240px]" 
              : "h-12 pl-14 pr-6 min-w-[220px] max-w-[280px]",
          isEditMode && `ring-2 ${customStyles.ring} ring-offset-2 dark:ring-offset-[#0A0A0A]`,
          isNodeDragging && "opacity-60 cursor-grabbing border border-indigo-500",
          isHoveredTarget && "ring-4 ring-purple-600 ring-offset-4 animate-pulse scale-105"
        )}
      >
        {/* Absolute circle on the left (Code Badge) */}
        {!isMinimal && (
          <div className={cn(
            "absolute -left-1 rounded-full border-[1.5px] border-slate-700 flex items-center justify-center shadow-sm z-10 transition-all",
            isCompact ? "w-10 h-10" : "w-[52px] h-[52px]",
            customStyles.badgeBg,
            customStyles.badgeText
          )}>
            <span className={cn("font-bold transition-all", isCompact ? "text-xs" : "text-[15px]")}>
              {node.code}
            </span>
          </div>
        )}
        
        {/* Text Area */}
        <div className={cn(
          "flex flex-col items-start justify-center text-left w-full overflow-hidden py-1",
          isMinimal ? "ml-0" : "ml-2"
        )}>
          <span 
            className={cn(
              "font-medium truncate w-full leading-tight",
              customStyles.text,
              isMinimal ? "text-[11px] text-center" : isCompact ? "text-xs" : "text-[13px]"
            )} 
            title={node.label}
          >
            {isMinimal ? `${node.code}: ${node.label}` : node.label}
          </span>
          {!isMinimal && (
            <span className={cn("font-medium text-[10px] mt-0.5 truncate w-full", customStyles.countText)}>
              {node.count} Positions
            </span>
          )}
        </div>

        {/* Quick Add Button in Edit Mode */}
        {isEditMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddClick(node);
            }}
            className="absolute -right-3 -top-3 w-7 h-7 bg-emerald-500 hover:bg-emerald-600 active:scale-90 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-[#0A0A0A] z-30 transition-all"
            title={`Add Position under ${node.label}`}
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
          </button>
        )}
      </div>
      
      {/* Bottom/Right Connection Circle / Expand Button */}
      {node.children.length > 0 && (
        <button 
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={cn(
            "absolute rounded-full border-[2.5px] bg-white flex items-center justify-center z-20 transition-all shadow-sm hover:scale-105 active:scale-95",
            isHorizontal 
              ? "top-1/2 -translate-y-1/2 right-0 w-[20px] h-[20px]" 
              : "-bottom-[6px] left-1/2 -translate-x-1/2 w-[22px] h-[22px]"
          )}
          style={{ borderColor: "var(--line-color)", color: "var(--line-color)" }}
        >
          {isExpanded ? <Minus className="w-2.5 h-2.5" strokeWidth={3} /> : <Plus className="w-2.5 h-2.5" strokeWidth={3} />}
        </button>
      )}
    </div>
  );
};

const TreeNodeRenderer = ({ 
  node, 
  expandedNodes, 
  toggleNode, 
  onNodeClick, 
  isEditMode, 
  onAddClick,
  layout,
  cardMode,
  themeConfig
}: { 
  node: TreeNode, 
  expandedNodes: Record<string, boolean>, 
  toggleNode: (id: string) => void, 
  onNodeClick: (node: TreeNode) => void, 
  isEditMode: boolean, 
  onAddClick: (node: TreeNode) => void,
  layout: 'vertical' | 'horizontal',
  cardMode: 'detailed' | 'compact' | 'minimal',
  themeConfig: any
}) => {
  const isExpanded = expandedNodes[node.id];
  const isHorizontal = layout === 'horizontal';

  return (
    <li>
      <NodeCard 
        node={node} 
        isExpanded={isExpanded} 
        onToggle={() => toggleNode(node.id)} 
        onClick={() => onNodeClick(node)} 
        isEditMode={isEditMode} 
        onAddClick={onAddClick}
        layout={layout}
        cardMode={cardMode}
        themeConfig={themeConfig}
      />
      {node.children.length > 0 && isExpanded && (
        <AnimatePresence>
          <motion.ul
            initial={isHorizontal ? { opacity: 0, scaleX: 0, originX: 0 } : { opacity: 0, scaleY: 0, originY: 0 }}
            animate={isHorizontal ? { opacity: 1, scaleX: 1 } : { opacity: 1, scaleY: 1 }}
            exit={isHorizontal ? { opacity: 0, scaleX: 0 } : { opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.3 }}
          >
            {node.children.map(child => (
              <TreeNodeRenderer 
                key={child.id} 
                node={child} 
                expandedNodes={expandedNodes} 
                toggleNode={toggleNode} 
                onNodeClick={onNodeClick} 
                isEditMode={isEditMode}
                onAddClick={onAddClick}
                layout={layout}
                cardMode={cardMode}
                themeConfig={themeConfig}
              />
            ))}
          </motion.ul>
        </AnimatePresence>
      )}
    </li>
  );
};

export function OrgChart() {
  const [orgData, setOrgData] = useState<OrgData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({ root: true });
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [prefilledAddForm, setPrefilledAddForm] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical');
  
  // Custom layout modes: vertical/horizontal auto tree structure, or free canvas whiteboard
  const [layoutMode, setLayoutMode] = useState<'auto-vertical' | 'auto-horizontal' | 'free'>('auto-vertical');
  
  // Coordinates dragging & hierarchy re-parenting states
  const [activeDragNode, setActiveDragNode] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number, y: number }>>({});
  const [hoveredTargetNode, setHoveredTargetNode] = useState<TreeNode | null>(null);
  const [isSavingHierarchy, setIsSavingHierarchy] = useState(false);

  // Find the dynamic bounding box of all resolved positions
  const maxCoords = useMemo(() => {
    let maxX = 4000;
    let maxY = 3000;
    Object.values(nodePositions).forEach(pos => {
      if (pos.x + 300 > maxX) maxX = pos.x + 300;
      if (pos.y + 400 > maxY) maxY = pos.y + 400;
    });
    return { w: maxX, h: maxY };
  }, [nodePositions]);

  const dragNodeStartPos = useRef({ x: 0, y: 0 });
  const dragPointerStartPos = useRef({ x: 0, y: 0 });
  const [chartTheme, setChartTheme] = useState<'emerald' | 'ocean' | 'sunset' | 'grape' | 'slate'>('emerald');
  const [cardMode, setCardMode] = useState<'detailed' | 'compact' | 'minimal'>('detailed');
  const [spacing, setSpacing] = useState<'compact' | 'normal' | 'spacious'>('normal');
  const [backgroundStyle, setBackgroundStyle] = useState<'dotted' | 'grid' | 'solid'>('dotted');
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  
  // Connecting Lines Customizable States
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [lineWidth, setLineWidth] = useState<'1px' | '2px' | '3px' | '4px'>('2px');
  const [lineRadius, setLineRadius] = useState<'0px' | '6px' | '12px'>('0px');
  const [customLineColor, setCustomLineColor] = useState<string>("");
  
  // Controls state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedStation, setSelectedStation] = useState("");
  
  const [scale, setScale] = useState(0.85); // Initial zoom
  const [isDragging, setIsDragging] = useState(false);

  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchOrg = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);
      setErrorMsg("");
      const res = await fetch("/api/organization", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch organization data");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid organization data");
      setOrgData(data);
    } catch (err: any) {
      setOrgData([]);
      setErrorMsg("ไม่สามารถเชื่อมต่อข้อมูลโครงสร้างองค์กรได้ในขณะนี้ กรุณาลองใหม่ หรือตรวจสอบการตั้งค่า AWS");
    } finally {
      setLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrg();
  }, []);

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleQuickAddClick = (node: TreeNode) => {
    // Extract first child item to pre-fill hierarchy if available
    const sample: any = node.data && node.data.length > 0 ? node.data[0] : {};
    
    const prefill: any = {
      position_en: "",
      position_th: "",
      department_en: sample.department_en && sample.department_en !== "-" ? sample.department_en : "",
      department_th: sample.department_th && sample.department_th !== "-" ? sample.department_th : "",
      department_code: sample.department_code && sample.department_code !== "-" ? sample.department_code : "",
      division_en: sample.division_en && sample.division_en !== "-" ? sample.division_en : "",
      division_th: sample.division_th && sample.division_th !== "-" ? sample.division_th : "",
      division_code: sample.division_code && sample.division_code !== "-" ? sample.division_code : "",
      section_en: sample.section_en && sample.section_en !== "-" ? sample.section_en : "",
      section_th: sample.section_th && sample.section_th !== "-" ? sample.section_th : "",
      section_code: sample.section_code && sample.section_code !== "-" ? sample.section_code : "",
      unit_en: sample.unit_en && sample.unit_en !== "-" ? sample.unit_en : "",
      unit_th: sample.unit_th && sample.unit_th !== "-" ? sample.unit_th : "",
      unit_code: sample.unit_code && sample.unit_code !== "-" ? sample.unit_code : "",
      station: sample.station && sample.station !== "-" ? sample.station : ""
    };

    // Pre-fill node-specific values based on node type
    if (node.type === 'department') {
      prefill.department_en = node.subLabel || node.label;
      prefill.department_th = node.label;
      prefill.department_code = node.code || "";
    } else if (node.type === 'division') {
      prefill.division_en = node.subLabel || node.label;
      prefill.division_th = node.label;
      prefill.division_code = node.code || "";
    } else if (node.type === 'station') {
      prefill.station = node.code || "";
    } else if (node.type === 'section') {
      prefill.section_en = node.subLabel || node.label;
      prefill.section_th = node.label;
      prefill.section_code = node.code || "";
    } else if (node.type === 'unit') {
      prefill.unit_en = node.subLabel || node.label;
      prefill.unit_th = node.label;
      prefill.unit_code = node.code || "";
    }

    setPrefilledAddForm(prefill);
    setIsAddModalOpen(true);
  };

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefilledAddForm) return;

    // Validate position name
    if (!prefilledAddForm.position_en?.trim() && !prefilledAddForm.position_th?.trim()) {
      alert("Please provide at least one position title (English or Thai).");
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch("/api/organization/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(prefilledAddForm),
      });

      if (!res.ok) {
        throw new Error("Failed to save new position.");
      }

      setIsAddModalOpen(false);
      setPrefilledAddForm(null);
      await fetchOrg();
    } catch (err: any) {
      alert(err.message || "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const departmentsList = useMemo(() => {
    const uniqueDepts = new Set<string>();
    const depts: { id: string, name: string, code: string }[] = [];
    orgData.forEach(item => {
      if (item.department_en && item.department_en !== "-" && !uniqueDepts.has(item.department_en)) {
        uniqueDepts.add(item.department_en);
        const nameEn = item.department_en;
        const code = item.department_code && item.department_code !== "-" ? item.department_code : "";
        const displayName = code ? `${nameEn} (${code})` : nameEn;
        depts.push({ id: item.department_en, name: displayName, code });
      }
    });
    return depts.sort((a, b) => a.code.localeCompare(b.code, 'en'));
  }, [orgData]);

  const divisionsList = useMemo(() => {
    const unique = new Set<string>();
    const list: { id: string, name: string, code: string }[] = [];
    orgData.filter(item => !selectedDepartment || item.department_en === selectedDepartment)
      .forEach(item => {
      if (item.division_en && item.division_en !== "-" && !unique.has(item.division_en)) {
        unique.add(item.division_en);
        const nameEn = item.division_en;
        const code = item.division_code && item.division_code !== "-" ? item.division_code : "";
        const displayName = code ? `${nameEn} (${code})` : nameEn;
        list.push({ id: item.division_en, name: displayName, code });
      }
    });
    return list.sort((a, b) => a.code.localeCompare(b.code, 'en'));
  }, [orgData, selectedDepartment]);

  const stationsList = useMemo(() => {
    const unique = new Set<string>();
    const list: { id: string, name: string }[] = [];
    orgData.filter(item => 
      (!selectedDepartment || item.department_en === selectedDepartment) && 
      (!selectedDivision || item.division_en === selectedDivision))
      .forEach(item => {
      if (item.station && item.station !== "-" && item.station !== "HDQ" && !unique.has(item.station)) {
        unique.add(item.station);
        list.push({ id: item.station, name: `Station ${item.station}` });
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  }, [orgData, selectedDepartment, selectedDivision]);

  const sectionsList = useMemo(() => {
    const unique = new Set<string>();
    const list: { id: string, name: string, code: string }[] = [];
    orgData.filter(item => 
      (!selectedDepartment || item.department_en === selectedDepartment) && 
      (!selectedDivision || item.division_en === selectedDivision) &&
      (!selectedStation || item.station === selectedStation))
      .forEach(item => {
      if (item.section_en && item.section_en !== "-" && !unique.has(item.section_en)) {
        unique.add(item.section_en);
        const nameEn = item.section_en;
        const code = item.section_code && item.section_code !== "-" ? item.section_code : "";
        const displayName = code ? `${nameEn} (${code})` : nameEn;
        list.push({ id: item.section_en, name: displayName, code });
      }
    });
    return list.sort((a, b) => a.code.localeCompare(b.code, 'en'));
  }, [orgData, selectedDepartment, selectedDivision, selectedStation]);

  const unitsList = useMemo(() => {
    const unique = new Set<string>();
    const list: { id: string, name: string, code: string }[] = [];
    orgData.filter(item => 
      (!selectedDepartment || item.department_en === selectedDepartment) && 
      (!selectedDivision || item.division_en === selectedDivision) &&
      (!selectedStation || item.station === selectedStation) &&
      (!selectedSection || item.section_en === selectedSection))
      .forEach(item => {
      if (item.unit_en && item.unit_en !== "-" && !unique.has(item.unit_en)) {
        unique.add(item.unit_en);
        const nameEn = item.unit_en;
        const code = item.unit_code && item.unit_code !== "-" ? item.unit_code : "";
        const displayName = code ? `${nameEn} (${code})` : nameEn;
        list.push({ id: item.unit_en, name: displayName, code });
      }
    });
    return list.sort((a, b) => a.code.localeCompare(b.code, 'en'));
  }, [orgData, selectedDepartment, selectedDivision, selectedStation, selectedSection]);

  const filteredData = useMemo(() => {
    let result = orgData;
    
    if (selectedDepartment) result = result.filter(item => item.department_en === selectedDepartment);
    if (selectedDivision) result = result.filter(item => item.division_en === selectedDivision);
    if (selectedStation) result = result.filter(item => item.station === selectedStation);
    if (selectedSection) result = result.filter(item => item.section_en === selectedSection);
    if (selectedUnit) result = result.filter(item => item.unit_en === selectedUnit);
    
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(item => {
        return (
          (item.department_en && item.department_en.toLowerCase().includes(query)) ||
          (item.department_th && item.department_th.toLowerCase().includes(query)) ||
          (item.division_en && item.division_en.toLowerCase().includes(query)) ||
          (item.division_th && item.division_th.toLowerCase().includes(query)) ||
          (item.section_en && item.section_en.toLowerCase().includes(query)) ||
          (item.section_th && item.section_th.toLowerCase().includes(query)) ||
          (item.unit_en && item.unit_en.toLowerCase().includes(query)) ||
          (item.unit_th && item.unit_th.toLowerCase().includes(query)) ||
          (item.station && item.station.toLowerCase().includes(query)) ||
          (item.position_en && item.position_en.toLowerCase().includes(query)) ||
          (item.position_th && item.position_th.toLowerCase().includes(query))
        );
      });
    }
    
    return result;
  }, [orgData, searchQuery, selectedDepartment, selectedDivision, selectedStation, selectedSection, selectedUnit]);

  const tree = useMemo(() => {
    return buildTree(filteredData);
  }, [filteredData]);

  const { nodes: flatNodes, connections: flatConnections } = useMemo(() => {
    return flattenTree(tree);
  }, [tree]);

  // Parent lookup map to check node visibility recursively in free layout
  const parentMap = useMemo(() => {
    const map: Record<string, string> = {};
    const buildMap = (node: TreeNode, parentId?: string) => {
      if (parentId) {
        map[node.id] = parentId;
      }
      node.children.forEach(c => buildMap(c, node.id));
    };
    if (tree) buildMap(tree);
    return map;
  }, [tree]);

  const isNodeVisible = (nodeId: string): boolean => {
    if (nodeId === 'root') return true;
    const parentId = parentMap[nodeId];
    if (!parentId) return true;
    if (!expandedNodes[parentId]) return false;
    return isNodeVisible(parentId);
  };

  const handleResetLayout = async () => {
    if (window.confirm("คุณต้องการจัดตำแหน่งแผนผังองค์กรใหม่โดยลบพิกัดที่บันทึกไว้ทั้งหมดใช่หรือไม่?")) {
      setIsSavingHierarchy(true);
      try {
        const res = await fetch("/api/organization/layout", { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to reset coordinates");
        await fetchOrg(); // Reload organization data (will default coordinates)
      } catch (err: any) {
        alert(err.message || "Failed to reset layout");
      } finally {
        setIsSavingHierarchy(false);
      }
    }
  };

  // Load and resolve coordinates
  useEffect(() => {
    if (!tree) return;
    const defaultLayout = computeDefaultLayout(tree);
    let resolved = resolveNodePositions(flatNodes, defaultLayout);
    
    // Sanitize resolved positions: ensure no coordinates are negative or cut off on the left/top
    const resolvedValues = Object.values(resolved);
    if (resolvedValues.length > 0) {
      const minX = Math.min(...resolvedValues.map(pos => pos.x));
      const minY = Math.min(...resolvedValues.map(pos => pos.y));
      
      let shiftX = 0;
      let shiftY = 0;
      if (minX < 200) shiftX = 200 - minX;
      if (minY < 150) shiftY = 150 - minY;
      
      if (shiftX !== 0 || shiftY !== 0) {
        const adjusted: Record<string, { x: number, y: number }> = {};
        Object.keys(resolved).forEach(id => {
          adjusted[id] = {
            x: resolved[id].x + shiftX,
            y: resolved[id].y + shiftY
          };
        });
        resolved = adjusted;
      }
    }
    
    setNodePositions(resolved);
  }, [tree, flatNodes]);

  useEffect(() => {
    if (searchQuery.trim() || selectedDepartment || selectedDivision || selectedSection || selectedUnit) {
      const expandAll = (node: TreeNode, acc: Record<string, boolean>) => {
        acc[node.id] = true;
        node.children.forEach(c => expandAll(c, acc));
        return acc;
      };
      setExpandedNodes(expandAll(tree, {}));
    }
  }, [searchQuery, selectedDepartment, selectedDivision, selectedSection, selectedUnit, tree]);

  const dragHasMoved = useRef(false);

  // Helper to determine database fields updates on reparenting
  const getReparentUpdates = (dragged: TreeNode, newParent: TreeNode) => {
    const updates: Record<string, string> = {};
    const pSample = newParent.data[0] || {};
    
    if (dragged.type === 'department') {
      return updates;
    }
    
    if (dragged.type === 'division') {
      updates.department_en = newParent.subLabel || newParent.label;
      updates.department_th = newParent.label;
      updates.department_code = newParent.code || "-";
    }
    
    if (dragged.type === 'station') {
      if (newParent.type === 'division') {
        updates.department_en = pSample.department_en || "-";
        updates.department_th = pSample.department_th || "-";
        updates.department_code = pSample.department_code || "-";
        updates.division_en = newParent.subLabel || newParent.label;
        updates.division_th = newParent.label;
        updates.division_code = newParent.code || "-";
      } else if (newParent.type === 'department') {
        updates.department_en = newParent.subLabel || newParent.label;
        updates.department_th = newParent.label;
        updates.department_code = newParent.code || "-";
        updates.division_en = "-";
        updates.division_th = "-";
        updates.division_code = "-";
      }
    }
    
    if (dragged.type === 'section') {
      if (newParent.type === 'station') {
        updates.department_en = pSample.department_en || "-";
        updates.department_th = pSample.department_th || "-";
        updates.department_code = pSample.department_code || "-";
        updates.division_en = pSample.division_en || "-";
        updates.division_th = pSample.division_th || "-";
        updates.division_code = pSample.division_code || "-";
        updates.station = newParent.code || "-";
      } else if (newParent.type === 'division') {
        updates.department_en = pSample.department_en || "-";
        updates.department_th = pSample.department_th || "-";
        updates.department_code = pSample.department_code || "-";
        updates.division_en = newParent.subLabel || newParent.label;
        updates.division_th = newParent.label;
        updates.division_code = newParent.code || "-";
        updates.station = "-";
      } else if (newParent.type === 'department') {
        updates.department_en = newParent.subLabel || newParent.label;
        updates.department_th = newParent.label;
        updates.department_code = newParent.code || "-";
        updates.division_en = "-";
        updates.division_th = "-";
        updates.division_code = "-";
        updates.station = "-";
      }
    }
    
    if (dragged.type === 'unit') {
      if (newParent.type === 'section') {
        updates.department_en = pSample.department_en || "-";
        updates.department_th = pSample.department_th || "-";
        updates.department_code = pSample.department_code || "-";
        updates.division_en = pSample.division_en || "-";
        updates.division_th = pSample.division_th || "-";
        updates.division_code = pSample.division_code || "-";
        updates.station = pSample.station || "-";
        updates.section_en = newParent.subLabel || newParent.label;
        updates.section_th = newParent.label;
        updates.section_code = newParent.code || "-";
      } else if (newParent.type === 'station') {
        updates.department_en = pSample.department_en || "-";
        updates.department_th = pSample.department_th || "-";
        updates.department_code = pSample.department_code || "-";
        updates.division_en = pSample.division_en || "-";
        updates.division_th = pSample.division_th || "-";
        updates.division_code = pSample.division_code || "-";
        updates.station = newParent.code || "-";
        updates.section_en = "-";
        updates.section_th = "-";
        updates.section_code = "-";
      } else if (newParent.type === 'division') {
        updates.department_en = pSample.department_en || "-";
        updates.department_th = pSample.department_th || "-";
        updates.department_code = pSample.department_code || "-";
        updates.division_en = newParent.subLabel || newParent.label;
        updates.division_th = newParent.label;
        updates.division_code = newParent.code || "-";
        updates.station = "-";
        updates.section_en = "-";
        updates.section_th = "-";
        updates.section_code = "-";
      } else if (newParent.type === 'department') {
        updates.department_en = newParent.subLabel || newParent.label;
        updates.department_th = newParent.label;
        updates.department_code = newParent.code || "-";
        updates.division_en = "-";
        updates.division_th = "-";
        updates.division_code = "-";
        updates.station = "-";
        updates.section_en = "-";
        updates.section_th = "-";
        updates.section_code = "-";
      }
    }
    
    return updates;
  };

  const handleNodeDragStart = (e: React.PointerEvent, nodeId: string) => {
    if (!isEditMode || (layoutMode as any) !== 'free') return;
    e.stopPropagation();
    
    const cardEl = e.currentTarget as HTMLElement;
    cardEl.setPointerCapture(e.pointerId);
    
    const pos = nodePositions[nodeId] || { x: 2000, y: 150 };
    dragNodeStartPos.current = { x: pos.x, y: pos.y };
    dragPointerStartPos.current = { x: e.clientX, y: e.clientY };
    dragHasMoved.current = false;
    setActiveDragNode(nodeId);
    setHoveredTargetNode(null);
  };

  const handleNodeDragMove = (e: React.PointerEvent) => {
    if (!activeDragNode) return;
    e.stopPropagation();
    
    const dx = (e.clientX - dragPointerStartPos.current.x) / scale;
    const dy = (e.clientY - dragPointerStartPos.current.y) / scale;
    
    if (Math.abs(dx * scale) > 4 || Math.abs(dy * scale) > 4) {
      dragHasMoved.current = true;
    }
    
    const newX = Math.max(150, dragNodeStartPos.current.x + dx);
    const newY = Math.max(50, dragNodeStartPos.current.y + dy);
    
    setNodePositions(prev => ({
      ...prev,
      [activeDragNode]: { x: newX, y: newY }
    }));
    
    // Parent-child collision detection
    const draggedNode = flatNodes.find(n => n.id === activeDragNode);
    if (draggedNode) {
      let closest: TreeNode | null = null;
      let minDistance = 160; // Max connection snapping distance
      
      const isDescendant = (parent: TreeNode, childId: string): boolean => {
        if (parent.id === childId) return true;
        return parent.children.some(c => isDescendant(c, childId));
      };
      
      flatNodes.forEach(candidate => {
        if (candidate.id === activeDragNode) return;
        // Cyclic connection prevention
        if (isDescendant(draggedNode, candidate.id)) return;
        
        if (isValidParent(draggedNode.type, candidate.type)) {
          const candidatePos = nodePositions[candidate.id];
          if (candidatePos) {
            const dist = Math.sqrt(
              Math.pow(newX - candidatePos.x, 2) +
              Math.pow(newY - candidatePos.y, 2)
            );
            if (dist < minDistance) {
              minDistance = dist;
              closest = candidate;
            }
          }
        }
      });
      setHoveredTargetNode(closest);
    }
  };

  const handleNodeDragEnd = async (e: React.PointerEvent) => {
    if (!activeDragNode) return;
    e.stopPropagation();
    const cardEl = e.currentTarget as HTMLElement;
    try {
      cardEl.releasePointerCapture(e.pointerId);
    } catch (err) {
      console.warn("Could not release pointer capture:", err);
    }
    
    const dragged = flatNodes.find(n => n.id === activeDragNode);
    const finalPos = nodePositions[activeDragNode];
    const target = hoveredTargetNode;
    
    setActiveDragNode(null);
    setHoveredTargetNode(null);
    
    if (target && dragged) {
      setIsSavingHierarchy(true);
      try {
        const sample = dragged.data[0] || {};
        const matchingFilter = {
          nodeType: dragged.type,
          nodeNameEn: dragged.type === 'station' ? dragged.code : (dragged.subLabel || dragged.label),
          department_en: sample.department_en,
          division_en: sample.division_en,
          station: sample.station,
          section_en: sample.section_en
        };
        const updates = getReparentUpdates(dragged, target);
        
        const res = await fetch("/api/organization/reparent", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchingFilter, updates })
        });
        if (!res.ok) throw new Error("Failed to update hierarchy");
        await fetchOrg();
      } catch (err: any) {
        alert(err.message || "Failed to reparent node");
      } finally {
        setIsSavingHierarchy(false);
      }
    } else if (dragged && finalPos && dragHasMoved.current) {
      try {
        const res = await fetch("/api/organization/layout", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: dragged.type,
            nameEn: dragged.type === 'station' ? dragged.code : (dragged.subLabel || dragged.label),
            layout_x: finalPos.x,
            layout_y: finalPos.y
          })
        });
        if (!res.ok) throw new Error("Failed to save coordinates");
      } catch (err) {
        console.error("Error saving coordinates:", err);
      }
    }
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.2));

  // Native drag to pan implementation
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    containerRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
    containerRef.current.scrollTop = dragStart.current.scrollTop - dy;
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Center scroll initially after data loads and whenever the tree structure changes (filters/search)
  useEffect(() => {
    if (containerRef.current && orgData.length > 0) {
      // Use setTimeout to allow React to render the new tree and expanded nodes before calculating scrollWidth
      const timer = setTimeout(() => {
        if (containerRef.current) {
          const container = containerRef.current;
          container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [orgData, tree]);

  // Handle wheel scrolling for zoom (using native event to prevent default browser zoom)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault(); // Prevents native browser zoom!
        if (e.deltaY > 0) {
          setScale(prev => Math.max(prev - 0.1, 0.2));
        } else {
          setScale(prev => Math.min(prev + 0.1, 2));
        }
      }
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col justify-center items-center bg-dotted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        <span className="ml-3 text-slate-500 mt-4 font-medium">Loading organization tree...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-[#0A0A0A]">
      {errorMsg && (
        <div className="mx-4 mt-4 flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => fetchOrg(true)}
            disabled={isRefreshing}
            className="shrink-0 rounded-lg border border-amber-300 px-3 py-1.5 font-medium hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-400/40 dark:hover:bg-amber-500/10"
          >
            {isRefreshing ? "กำลังลองใหม่..." : "ลองใหม่"}
          </button>
        </div>
      )}
      
      {/* --- HEADER & TOOLBAR --- */}
      <div className="flex flex-col border-b border-slate-200 dark:border-white/10 shrink-0 z-40 bg-white dark:bg-[#0A0A0A]">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-4 lg:px-6 lg:py-4 gap-4">
          <div className="flex items-center justify-between w-full lg:w-auto">
            <h1 className="text-xl lg:text-2xl font-semibold text-slate-800 dark:text-white shrink-0 mr-6">Organization Structure</h1>
            <div className="flex lg:hidden items-center gap-2">
              <button 
                onClick={() => setIsEditMode(!isEditMode)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all shadow-sm duration-300",
                  isEditMode 
                    ? "bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-500 ring-offset-1 dark:ring-offset-[#0A0A0A]" 
                    : "bg-[#407B6B] hover:bg-[#2C574B] text-white"
                )}
              >
                {isEditMode ? "Exit Edit" : "Edit Structure"}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 flex-wrap flex-1 justify-start lg:justify-end w-full lg:w-auto">
            
            {/* Search Bar */}
            <div className="relative w-full lg:w-64 h-9 shrink-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input 
                type="text" 
                placeholder="Search name, position..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md pl-9 pr-8 text-sm text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm transition-shadow"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-0.5 hidden lg:block"></div>

            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setSelectedDivision("");
                setSelectedSection("");
                setSelectedUnit("");
              }}
              className="h-9 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md px-2.5 text-[13px] text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm cursor-pointer w-[140px] shrink-0 truncate"
            >
              <option value="">All Departments</option>
              {departmentsList.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>

            <select
              value={selectedDivision}
              onChange={(e) => {
                setSelectedDivision(e.target.value);
                setSelectedStation("");
                setSelectedSection("");
                setSelectedUnit("");
              }}
              className="h-9 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md px-2.5 text-[13px] text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm cursor-pointer w-[140px] shrink-0 truncate"
            >
              <option value="">All Divisions</option>
              {divisionsList.map(div => (
                <option key={div.id} value={div.id}>{div.name}</option>
              ))}
            </select>

            <select
              value={selectedStation}
              onChange={(e) => {
                setSelectedStation(e.target.value);
                setSelectedSection("");
                setSelectedUnit("");
              }}
              className="h-9 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md px-2.5 text-[13px] text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm cursor-pointer w-[140px] shrink-0 truncate"
            >
              <option value="">All Stations</option>
              {stationsList.map(sta => (
                <option key={sta.id} value={sta.id}>{sta.name}</option>
              ))}
            </select>

            <select
              value={selectedSection}
              onChange={(e) => {
                setSelectedSection(e.target.value);
                setSelectedUnit("");
              }}
              className="h-9 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md px-2.5 text-[13px] text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm cursor-pointer w-[140px] shrink-0 truncate"
            >
              <option value="">All Sections</option>
              {sectionsList.map(sec => (
                <option key={sec.id} value={sec.id}>{sec.name}</option>
              ))}
            </select>

            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="h-9 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md px-2.5 text-[13px] text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm cursor-pointer w-[140px] shrink-0 truncate"
            >
              <option value="">All Units</option>
              {unitsList.map(unit => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </select>

            {/* Clear Button */}
            {(selectedDepartment || selectedDivision || selectedStation || selectedSection || selectedUnit || searchQuery) && (
              <button 
                onClick={() => {
                  setSelectedDepartment("");
                  setSelectedDivision("");
                  setSelectedStation("");
                  setSelectedSection("");
                  setSelectedUnit("");
                  setSearchQuery("");
                }}
                className="h-9 px-3 flex items-center justify-center text-rose-500 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10 shadow-sm transition-colors shrink-0 text-[13px] font-medium"
              >
                Clear
              </button>
            )}

            {/* Divider */}
            <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-0.5 hidden lg:block"></div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md p-0.5 shadow-sm h-9 shrink-0">
              <button onClick={handleZoomOut} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-colors"><Minus className="w-3.5 h-3.5" /></button>
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 min-w-[2.5rem] text-center">{Math.round(scale * 100)}%</span>
              <button onClick={handleZoomIn} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-colors"><Plus className="w-3.5 h-3.5" /></button>
            </div>

            {/* Actions */}
            <div className="hidden lg:flex items-center gap-1.5 ml-1">
              <button
                type="button"
                onClick={() => fetchOrg(true)}
                disabled={isRefreshing}
                className="h-9 px-3 flex items-center justify-center gap-1.5 text-sky-600 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/20 rounded-md hover:bg-sky-100 dark:hover:bg-sky-500/20 shadow-sm transition-colors disabled:opacity-70 text-[13px] font-semibold"
                title="Refresh organization data"
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                Refresh
              </button>
              <button className="w-9 h-9 flex items-center justify-center text-slate-500 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md hover:bg-slate-50 dark:hover:bg-white/5 shadow-sm transition-colors">
                <Send className="w-4 h-4" />
              </button>
              <button className="w-9 h-9 flex items-center justify-center text-slate-500 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md hover:bg-slate-50 dark:hover:bg-white/5 shadow-sm transition-colors">
                <Download className="w-4 h-4" />
              </button>
              <button className="w-9 h-9 flex items-center justify-center text-slate-500 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-md hover:bg-slate-50 dark:hover:bg-white/5 shadow-sm transition-colors">
                <Printer className="w-4 h-4" />
              </button>
              {isEditMode && (
                <button 
                  onClick={() => {
                    setPrefilledAddForm({
                      position_en: "",
                      position_th: "",
                      department_en: "",
                      department_th: "",
                      department_code: "",
                      division_en: "",
                      division_th: "",
                      division_code: "",
                      section_en: "",
                      section_th: "",
                      section_code: "",
                      unit_en: "",
                      unit_th: "",
                      unit_code: "",
                      station: ""
                    });
                    setIsAddModalOpen(true);
                  }}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-medium rounded-md transition-all shadow-sm flex items-center gap-1.5 ml-2"
                >
                  <Plus className="w-4 h-4" /> Add Position
                </button>
              )}
              <button 
                onClick={() => setIsEditMode(!isEditMode)}
                className={cn(
                  "px-4 py-1.5 text-[13px] font-medium rounded-md transition-all shadow-sm duration-300 ml-2",
                  isEditMode 
                    ? "bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-500 ring-offset-2 dark:ring-offset-[#0A0A0A]" 
                    : "bg-[#407B6B] hover:bg-[#2C574B] text-white"
                )}
              >
                {isEditMode ? "Exit Edit Mode" : "Edit Structure"}
              </button>
              <button 
                onClick={() => setIsCustomizerOpen(!isCustomizerOpen)}
                className={cn(
                  "px-4 py-1.5 text-[13px] font-medium rounded-md transition-all shadow-sm duration-300 ml-2 flex items-center gap-1.5 border border-slate-200 dark:border-white/10",
                  isCustomizerOpen 
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                    : "bg-white dark:bg-[#121212] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                )}
              >
                <Sliders className="w-4 h-4" /> Appearance
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* --- NATIVE INFINITE CANVAS --- */}
      <div className={cn(
        "relative flex-1 w-full overflow-hidden transition-all duration-300",
        backgroundStyle === 'dotted' ? "bg-dotted" : backgroundStyle === 'grid' ? "bg-grid" : "bg-solid bg-slate-50/50 dark:bg-[#0B0B0B]"
      )}>
      <div
        ref={containerRef}
        className={cn(
          "absolute inset-0 overflow-auto hide-scrollbar touch-none",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div 
          className="min-w-max min-h-max inline-block pt-32 pb-[80vh] px-[50vw] transition-transform duration-100 origin-top"
          style={{ transform: `scale(${scale})` }}
        >
            {layoutMode === 'free' ? (
              <div 
                className="relative select-none"
                style={{ 
                  width: `${maxCoords.w}px`, 
                  height: `${maxCoords.h}px` 
                }}
              >
                {/* SVG Connections in Free Layout */}
                <svg 
                  className="absolute inset-0 pointer-events-none"
                  style={{ width: '100%', height: '100%', overflow: 'visible' }}
                >
                  {flatConnections.map(conn => {
                    if (!isNodeVisible(conn.fromId) || !isNodeVisible(conn.toId)) return null;
                    
                    const fromPos = nodePositions[conn.fromId];
                    const toPos = nodePositions[conn.toId];
                    if (!fromPos || !toPos) return null;
                    
                    const path = getBezierPath(
                      fromPos.x, 
                      fromPos.y, 
                      toPos.x, 
                      toPos.y, 
                      lineRadius,
                      cardMode
                    );
                    
                    return (
                      <path
                        key={conn.id}
                        d={path}
                        fill="none"
                        stroke={customLineColor || themeColors[chartTheme].line}
                        strokeWidth={lineWidth}
                        strokeDasharray={lineStyle === 'dashed' ? '5,5' : lineStyle === 'dotted' ? '2,2' : undefined}
                      />
                    );
                  })}
                </svg>

                {/* Free Drag Absolute Nodes */}
                {flatNodes.map(node => {
                  const pos = nodePositions[node.id] || { x: 2000, y: 150 };
                  const isExpanded = expandedNodes[node.id];
                  
                  if (!isNodeVisible(node.id)) return null;

                  return (
                    <div
                      key={node.id}
                      className="absolute"
                      style={{
                        left: `${pos.x}px`,
                        top: `${pos.y}px`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: activeDragNode === node.id ? 50 : 10
                      }}
                    >
                      <NodeCard
                        node={node}
                        isExpanded={isExpanded}
                        onToggle={() => toggleNode(node.id)}
                        onClick={() => setSelectedNode(node)}
                        isEditMode={isEditMode}
                        onAddClick={handleQuickAddClick}
                        layout="vertical"
                        cardMode={cardMode}
                        themeConfig={themeColors[chartTheme]}
                        isFreeLayout={true}
                        isNodeDragging={activeDragNode === node.id}
                        isHoveredTarget={hoveredTargetNode?.id === node.id}
                        onDragStart={(e) => handleNodeDragStart(e, node.id)}
                        onDragMove={handleNodeDragMove}
                        onDragEnd={handleNodeDragEnd}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div 
                className={cn(
                  "org-tree",
                  layoutMode === 'auto-horizontal' && "horizontal",
                  spacing === 'compact' ? "spacing-compact" : spacing === 'spacious' ? "spacing-spacious" : "spacing-normal"
                )}
                style={{ 
                  ['--line-color' as any]: customLineColor || themeColors[chartTheme].line,
                  ['--line-style' as any]: lineStyle,
                  ['--line-width' as any]: lineWidth,
                  ['--line-radius' as any]: lineRadius,
                  ['--card-bg' as any]: themeColors[chartTheme].line
                }}
              >
                <ul>
                  <TreeNodeRenderer 
                    node={tree} 
                    expandedNodes={expandedNodes} 
                    toggleNode={toggleNode} 
                    onNodeClick={setSelectedNode} 
                    isEditMode={isEditMode}
                    onAddClick={handleQuickAddClick}
                    layout={layoutMode === 'auto-horizontal' ? 'horizontal' : 'vertical'}
                    cardMode={cardMode}
                    themeConfig={themeColors[chartTheme]}
                  />
                </ul>
              </div>
            )}
        </div>
      </div>

      {isSavingHierarchy && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 transition-all duration-300">
          <div className="bg-white/95 dark:bg-black/90 p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-xs text-center border border-slate-100 dark:border-white/10">
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, ease: "linear", duration: 1 }} 
              className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mb-4"
            />
            <h4 className="font-bold text-slate-800 dark:text-white text-sm">Saving Hierarchy Changes...</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Updating positions and reorganizing structure</p>
          </div>
        </div>
      )}
      
      {filteredData.length === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center py-12 bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-sm z-30">
          <p className="text-slate-500">No organizational data found.</p>
        </div>
      )}

      {/* Click Details Drawer */}
      <OrgDetailDrawer 
        isOpen={selectedNode !== null}
        onClose={() => setSelectedNode(null)}
        node={selectedNode}
        onUpdate={() => fetchOrg()}
        isEditMode={isEditMode}
      />

      {/* Add Position Modal */}
      <AnimatePresence>
        {isAddModalOpen && prefilledAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isSaving) {
                  setIsAddModalOpen(false);
                  setPrefilledAddForm(null);
                }
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-2xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#121212]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Add New Position</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Define position details and hierarchical attributes</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setPrefilledAddForm(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSavePosition} className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Section 1: Position Names */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Position Titles</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Position Name (EN) *</label>
                      <input
                        type="text"
                        required
                        value={prefilledAddForm.position_en || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, position_en: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                        placeholder="e.g. Flight Operations Manager"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Position Name (TH)</label>
                      <input
                        type="text"
                        value={prefilledAddForm.position_th || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, position_th: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                        placeholder="e.g. ผู้จัดการฝ่ายปฏิบัติการบิน"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Department & Division */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                  <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Department & Division</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Department (EN)</label>
                      <input
                        type="text"
                        value={prefilledAddForm.department_en || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, department_en: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Department (TH)</label>
                      <input
                        type="text"
                        value={prefilledAddForm.department_th || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, department_th: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Department Code</label>
                      <input
                        type="text"
                        value={prefilledAddForm.department_code || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, department_code: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                        placeholder="e.g. OD"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Division (EN)</label>
                      <input
                        type="text"
                        value={prefilledAddForm.division_en || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, division_en: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Division (TH)</label>
                      <input
                        type="text"
                        value={prefilledAddForm.division_th || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, division_th: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Division Code</label>
                      <input
                        type="text"
                        value={prefilledAddForm.division_code || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, division_code: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                        placeholder="e.g. FD"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Section & Unit */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                  <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Section & Unit</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Section (EN)</label>
                      <input
                        type="text"
                        value={prefilledAddForm.section_en || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, section_en: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Section (TH)</label>
                      <input
                        type="text"
                        value={prefilledAddForm.section_th || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, section_th: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Section Code</label>
                      <input
                        type="text"
                        value={prefilledAddForm.section_code || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, section_code: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Unit (EN)</label>
                      <input
                        type="text"
                        value={prefilledAddForm.unit_en || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, unit_en: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Unit (TH)</label>
                      <input
                        type="text"
                        value={prefilledAddForm.unit_th || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, unit_th: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Unit Code</label>
                      <input
                        type="text"
                        value={prefilledAddForm.unit_code || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, unit_code: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Station */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                  <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Location / Station</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Station Code</label>
                      <input
                        type="text"
                        value={prefilledAddForm.station || ""}
                        onChange={(e) => setPrefilledAddForm({ ...prefilledAddForm, station: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                        placeholder="e.g. DMK, BKK, HKT"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3 bg-white dark:bg-[#0A0A0A] sticky bottom-0 z-10 py-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setPrefilledAddForm(null);
                    }}
                    className="px-4 py-2 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isSaving && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: 1 }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                    Save Position
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Appearance Customizer Panel */}
      <AnimatePresence>
        {isCustomizerOpen && (
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            className="fixed top-36 right-6 z-40 w-80 bg-white/95 dark:bg-[#0A0A0A]/95 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-md p-5 flex flex-col max-h-[72vh] overflow-y-auto select-none gap-5 custom-scrollbar"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-500" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">ปรับแต่งการแสดงผล</h4>
              </div>
              <button 
                onClick={() => setIsCustomizerOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Layout Mode */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">โหมดแสดงผล</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['auto-vertical', 'auto-horizontal', 'free'] as const).map(mode => {
                  const labels = {
                    'auto-vertical': 'แผนภูมิแนวตั้ง',
                    'auto-horizontal': 'แผนภูมิแนวนอน',
                    'free': 'กระดานอิสระ'
                  };
                  return (
                    <button
                      key={mode}
                      onClick={() => setLayoutMode(mode)}
                      className={cn(
                        "py-1.5 px-1 rounded-lg text-[10px] font-semibold border text-center transition-all",
                        layoutMode === mode
                          ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "bg-transparent border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                      )}
                    >
                      {labels[mode]}
                    </button>
                  );
                })}
              </div>
              
              {layoutMode === 'free' && (
                <button
                  onClick={handleResetLayout}
                  className="mt-2 w-full py-1.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-semibold rounded-lg border border-rose-200 dark:border-rose-900/40 transition-all text-center block"
                >
                  จัดกึ่งกลางและตำแหน่งใหม่ (Auto Align)
                </button>
              )}
            </div>

            {/* Preset Theme Color */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">สีหลักของธีม</label>
              <div className="grid grid-cols-5 gap-2">
                {(['emerald', 'ocean', 'sunset', 'grape', 'slate'] as const).map(t => {
                  const colors = {
                    emerald: "bg-emerald-500 hover:bg-emerald-600 ring-emerald-500",
                    ocean: "bg-sky-500 hover:bg-sky-600 ring-sky-500",
                    sunset: "bg-orange-500 hover:bg-orange-600 ring-orange-500",
                    grape: "bg-violet-500 hover:bg-violet-600 ring-violet-500",
                    slate: "bg-slate-500 hover:bg-slate-600 ring-slate-500",
                  };
                  return (
                    <button
                      key={t}
                      onClick={() => setChartTheme(t)}
                      className={cn(
                        "w-10 h-10 rounded-full transition-all border-2 border-white dark:border-[#0A0A0A] shadow-sm shrink-0",
                        colors[t],
                        chartTheme === t ? "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-[#0A0A0A] scale-110" : "opacity-80 hover:opacity-100"
                      )}
                      title={t.charAt(0).toUpperCase() + t.slice(1)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Card Detail Compactness */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">ระดับรายละเอียดการ์ด</label>
              <div className="grid grid-cols-3 gap-2">
                {(['detailed', 'compact', 'minimal'] as const).map(mode => {
                  const labels = {
                    detailed: 'ละเอียด',
                    compact: 'กระชับ',
                    minimal: 'เรียบง่าย'
                  };
                  return (
                    <button
                      key={mode}
                      onClick={() => setCardMode(mode)}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-xs font-medium border text-center capitalize transition-all",
                        cardMode === mode
                          ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "bg-transparent border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                      )}
                    >
                      {labels[mode]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Node Spacing density */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">ความหนาแน่นของระยะห่าง</label>
              <div className="grid grid-cols-3 gap-2">
                {(['compact', 'normal', 'spacious'] as const).map(density => {
                  const labels = {
                    compact: 'ชิด',
                    normal: 'ปกติ',
                    spacious: 'ห่าง'
                  };
                  return (
                    <button
                      key={density}
                      onClick={() => setSpacing(density)}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-xs font-medium border text-center capitalize transition-all",
                        spacing === density
                          ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "bg-transparent border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                      )}
                    >
                      {labels[density]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Background Style Grid */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">พื้นหลังผืนผ้าใบ</label>
              <div className="grid grid-cols-3 gap-2">
                {(['dotted', 'grid', 'solid'] as const).map(bg => {
                  const labels = {
                    dotted: 'ลายจุด',
                    grid: 'ลายตาราง',
                    solid: 'สีพื้นทึบ'
                  };
                  return (
                    <button
                      key={bg}
                      onClick={() => setBackgroundStyle(bg)}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-xs font-medium border text-center capitalize transition-all",
                        backgroundStyle === bg
                          ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "bg-transparent border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                      )}
                    >
                      {labels[bg]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 dark:border-white/5 pt-1"></div>

            {/* Line Patterns / Styles */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">รูปแบบเส้นเชื่อม</label>
              <div className="grid grid-cols-3 gap-2">
                {(['solid', 'dashed', 'dotted'] as const).map(style => {
                  const labels = {
                    solid: 'เส้นทึบ',
                    dashed: 'เส้นประ',
                    dotted: 'จุดไข่ปลา'
                  };
                  return (
                    <button
                      key={style}
                      onClick={() => setLineStyle(style)}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-xs font-medium border text-center capitalize transition-all",
                        lineStyle === style
                          ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "bg-transparent border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                      )}
                    >
                      {labels[style]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Line Thickness */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">ความหนาของเส้น</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['1px', '2px', '3px', '4px'] as const).map(width => (
                  <button
                    key={width}
                    onClick={() => setLineWidth(width)}
                    className={cn(
                      "py-1.5 rounded-lg text-xs font-medium border text-center transition-all",
                      lineWidth === width
                        ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "bg-transparent border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                    )}
                  >
                    {width}
                  </button>
                ))}
              </div>
            </div>

            {/* Corner Curvature */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">ความโค้งของมุมเส้น</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: '0px', label: 'มุมฉาก' },
                  { value: '6px', label: 'มุมมน' },
                  { value: '12px', label: 'มุมโค้ง' }
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setLineRadius(opt.value)}
                    className={cn(
                      "px-1 py-1.5 rounded-lg text-xs font-medium border text-center transition-all",
                      lineRadius === opt.value
                        ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "bg-transparent border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Line Color Picker */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">สีของเส้นเชื่อม</label>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#121212] border border-slate-100 dark:border-white/5 p-2 rounded-xl">
                <input 
                  type="color" 
                  value={customLineColor || themeColors[chartTheme].line} 
                  onChange={(e) => setCustomLineColor(e.target.value)} 
                  className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 dark:border-white/10 overflow-hidden bg-transparent shrink-0"
                  title="เลือกสีเส้นที่กำหนดเอง"
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200">
                    {customLineColor ? "กำหนดสีเอง" : "ใช้สีเดียวกับธีมการ์ด"}
                  </span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                    {customLineColor || themeColors[chartTheme].line}
                  </span>
                </div>
                {customLineColor && (
                  <button 
                    type="button"
                    onClick={() => setCustomLineColor("")}
                    className="text-[10px] text-rose-500 hover:text-rose-600 font-semibold ml-auto hover:underline"
                  >
                    รีเซ็ต
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
