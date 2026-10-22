"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<"input"> & { label?: string; supportingText?: string };

function Input({ className, type, label, supportingText, ...props }: InputProps) {
  const generatedId = React.useId();
  const inputId = props.id ?? (label ? generatedId : undefined);
  const hintId = `${generatedId}-hint`;
  const describedBy = [props["aria-describedby"], supportingText ? hintId : null].filter(Boolean).join(" ") || undefined;
  const input = (
    <input
      data-slot="input"
      data-fixed-height={className && /(?:^|\s)(?:[\w-]+:)*h-/.test(className) ? "true" : undefined}
      data-labeled={label ? "true" : undefined}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-surface px-3.5 py-2 text-sm shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-[background-color,border-color,box-shadow] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
      id={inputId}
      placeholder={props.placeholder ?? (label ? " " : undefined)}
      aria-describedby={describedBy}
    />
  );
  const hint = supportingText ? <p data-slot="field-supporting-text" id={hintId}>{supportingText}</p> : null;
  if (!label) return hint ? <div data-slot="field">{input}{hint}</div> : input;
  return (
    <div data-slot="field">
      <div data-slot="field-control">
        <label data-slot="field-label" htmlFor={inputId}>{label}</label>
        {input}
      </div>
      {hint}
    </div>
  );
}

export { Input };
