"use client";

import * as React from "react";
import { ChevronDown } from "@/lib/icons";
import { cn } from "@/lib/utils";

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      value,
      onValueChange,
      options,
      placeholder = "選択してください",
      disabled = false,
      className,
      "aria-label": ariaLabel,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const listboxId = React.useId();

    const selectedOption = options.find((opt) => opt.value === value);
    const displayLabel = selectedOption?.label ?? placeholder;

    // 外側クリックで閉じる
    React.useEffect(() => {
      if (!isOpen) return;
      const handleClickOutside = (event: MouseEvent) => {
        if (!containerRef.current?.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Escapeで閉じる
    React.useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setIsOpen(false);
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
      onValueChange(optionValue);
      setIsOpen(false);
    };

    return (
      <div ref={containerRef} className="relative">
        <button
          ref={ref}
          type="button"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-surface px-3.5 py-2 text-sm text-foreground shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-[background-color,border-color,box-shadow]",
            "hover:bg-surface-secondary focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !selectedOption && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-[0_12px_28px_rgba(15,23,42,0.12)] animate-in fade-in-0 zoom-in-95"
          >
            <div className="max-h-60 overflow-y-auto py-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  disabled={option.disabled}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "flex w-full items-center px-3.5 py-2.5 text-sm transition-colors",
                    "hover:bg-surface-hover focus:bg-surface-hover focus:outline-none",
                    option.value === value && "bg-surface-selected text-primary font-medium",
                    option.disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select };
export type { SelectOption, SelectProps };
