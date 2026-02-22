import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEPARTMENT_COLORS, DEPARTMENT_PRESETS } from '@/hooks/useSpendData';

interface Props {
  departments: { id: string; name: string }[];
  selected: string[];
  onChange: (departments: string[]) => void;
}

function arraysMatch(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

export function DepartmentMultiSelect({ departments, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, []);

  useEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  const toggleDept = (dept: string) => {
    if (selected.includes(dept)) {
      onChange(selected.filter(d => d !== dept));
    } else {
      onChange([...selected, dept]);
    }
  };

  const removeDept = (dept: string) => {
    onChange(selected.filter(d => d !== dept));
  };

  const activePreset = Object.entries(DEPARTMENT_PRESETS).find(([, depts]) => arraysMatch(selected, depts))?.[0];

  return (
    <div className="flex flex-col gap-2">
      {/* Presets */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Quick:</span>
        {Object.entries(DEPARTMENT_PRESETS).map(([name, depts]) => (
          <button
            key={name}
            onClick={() => onChange(arraysMatch(selected, depts) ? [] : depts)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              activePreset === name
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
            }`}
          >
            {name}
          </button>
        ))}
        <button
          onClick={() => onChange([])}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
            selected.length === 0
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
          }`}
        >
          All
        </button>
      </div>

      {/* Multi-select dropdown + chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          ref={triggerRef}
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setOpen(!open)}
        >
          <span>{selected.length === 0 ? 'All Departments' : `${selected.length} selected`}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>

        {/* Portal-based dropdown */}
        {open && createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[99]"
              onClick={() => setOpen(false)}
            />
            {/* Dropdown */}
            <div
              className="fixed z-[100] w-56 rounded-lg border border-border bg-popover shadow-lg max-h-[300px] overflow-y-auto"
              style={{ top: dropdownPos.top, left: dropdownPos.left }}
            >
              {departments.map(dept => {
                const isSelected = selected.includes(dept.name);
                const color = DEPARTMENT_COLORS[dept.name] ?? '#6B7280';
                return (
                  <button
                    key={dept.id}
                    onClick={() => toggleDept(dept.name)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded hover:bg-accent transition-colors text-foreground"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-primary border-primary' : 'border-border'
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span>{dept.name}</span>
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}

        {/* Chips */}
        {selected.map(dept => {
          const color = DEPARTMENT_COLORS[dept] ?? '#6B7280';
          return (
            <span
              key={dept}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}30` }}
            >
              {dept}
              <button onClick={() => removeDept(dept)} className="hover:opacity-70">
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
