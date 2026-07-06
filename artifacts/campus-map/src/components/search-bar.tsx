import React, { useState, useEffect, useRef } from "react";
import { Search, X, Building2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface SearchSuggestion {
  type: "building" | "place";
  dbId?: number;
  name: string;
  subtitle: string;
  lng: number;
  lat: number;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: SearchSuggestion[];
  onSelectSuggestion?: (s: SearchSuggestion) => void;
}

export function SearchBar({
  value,
  onChange,
  suggestions = [],
  onSelectSuggestion,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, onChange, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showDropdown = open && localValue.length >= 2 && suggestions.length > 0;

  const handleSelect = (s: SearchSuggestion) => {
    onSelectSuggestion?.(s);
    setLocalValue("");
    onChange("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-muted-foreground" />
      </div>
      <Input
        type="text"
        placeholder="Search buildings, fields, events..."
        className="pl-9 pr-10 h-10 w-full bg-background border-border shadow-sm"
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {localValue && (
        <div className="absolute inset-y-0 right-0 pr-1 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full"
            onClick={() => {
              setLocalValue("");
              onChange("");
              setOpen(false);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {showDropdown && (
        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 rounded-xl border border-border bg-popover/95 backdrop-blur-sm shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-accent/60 transition-colors border-b border-border/40 last:border-0"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                {s.type === "building" ? (
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <MapPin className="h-3.5 w-3.5 text-green-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{s.name}</div>
                <div className="truncate text-xs text-muted-foreground capitalize">{s.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
