import React, { useState, useMemo } from "react";
import { Building, BuildingEventStatus, EventStatus } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

interface CampusMapProps {
  buildings: Building[];
  selectedBuildingId: number | null;
  onSelectBuilding: (id: number | null) => void;
}

export function CampusMap({ buildings, selectedBuildingId, onSelectBuilding }: CampusMapProps) {
  // A simplistic mapping to render rectangles for each building based on x, y, width, height
  
  const getBuildingColor = (status: BuildingEventStatus) => {
    switch (status) {
      case "active":
        return "fill-green-500 stroke-green-600";
      case "upcoming_today":
        return "fill-secondary stroke-secondary-foreground/20";
      case "upcoming_week":
        return "fill-primary/60 stroke-primary";
      default:
        return "fill-muted-foreground/20 stroke-muted-foreground/40";
    }
  };

  return (
    <div className="relative w-full h-full bg-[#E5E9E0] dark:bg-card/40 overflow-hidden rounded-xl border border-border shadow-inner">
      {/* Decorative background elements to simulate campus */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <rect width="100%" height="100%" fill="currentColor" className="text-[#E5E9E0] dark:text-muted/30" />
        <path d="M0,30 Q20,10 50,40 T100,50" fill="none" stroke="#D1D5CB" strokeWidth="2" />
        {/* Simple path for roads */}
        <path d="M 20 0 L 20 100 M 50 0 L 50 100 M 80 0 L 80 100 M 0 30 L 100 30 M 0 60 L 100 60" 
              stroke="rgba(0,0,0,0.05)" strokeWidth="4" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="absolute inset-0 p-8">
        <div className="relative w-full h-full">
          {buildings.map((building) => {
            const isSelected = selectedBuildingId === building.id;
            const colorClass = getBuildingColor(building.eventStatus);
            const isActive = building.eventStatus === "active";
            
            return (
              <motion.div
                key={building.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${building.x}%`,
                  top: `${building.y}%`,
                  width: `${building.width}%`,
                  height: `${building.height}%`,
                }}
                whileHover={{ scale: 1.05 }}
                animate={{
                  scale: isSelected ? 1.05 : 1,
                  zIndex: isSelected ? 10 : 1
                }}
              >
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded bg-green-400 opacity-40 blur-md pointer-events-none"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.2, 0.4] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                )}
                
                <button
                  onClick={() => onSelectBuilding(isSelected ? null : building.id)}
                  className={`w-full h-full relative cursor-pointer outline-none focus:ring-2 focus:ring-primary rounded transition-all duration-300 ${
                    isSelected ? "ring-4 ring-primary shadow-xl" : "shadow-md"
                  }`}
                  aria-label={`Select ${building.name}`}
                >
                  <svg width="100%" height="100%" preserveAspectRatio="none" className="overflow-visible">
                    <rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      rx="4"
                      className={`${colorClass} transition-colors duration-300`}
                      strokeWidth={isSelected ? "3" : "1.5"}
                    />
                  </svg>
                  
                  <div className="absolute inset-0 flex items-center justify-center p-1 overflow-hidden">
                    <span className={`text-[10px] sm:text-xs font-bold text-center leading-tight ${isSelected || isActive || building.eventStatus !== "none" ? "text-primary-foreground drop-shadow-md" : "text-muted-foreground"}`}>
                      {building.shortName}
                    </span>
                  </div>
                  
                  {building.activeEventCount > 0 && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm border border-white">
                      {building.activeEventCount}
                    </div>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
