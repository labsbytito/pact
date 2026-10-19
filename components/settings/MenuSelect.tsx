import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export function MenuSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find((item) => item.value === value)?.label ?? value;
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="menu-select" ref={root}>
      <span>{label}</span>
      <button className="menu-trigger" type="button" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((value) => !value)}>
        <span>{current}</span>
        <ChevronDown size={12} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open && (
        <div className="menu pop glass" role="listbox" aria-label={label}>
          {options.map((item) => (
            <button key={item.value} type="button" role="option" aria-selected={item.value === value} onClick={() => { onChange(item.value); setOpen(false); }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
