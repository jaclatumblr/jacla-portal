"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TooltipProps = {
    content: React.ReactNode;
    children: React.ReactElement;
    side?: "top" | "bottom" | "left" | "right";
    align?: "start" | "center" | "end";
    delayMs?: number;
    className?: string;
};

function Tooltip({
    content,
    children,
    side = "top",
    align = "center",
    delayMs = 300,
    className,
}: TooltipProps) {
    const [isVisible, setIsVisible] = React.useState(false);
    const [position, setPosition] = React.useState({ top: 0, left: 0 });
    const triggerRef = React.useRef<HTMLElement>(null);
    const tooltipRef = React.useRef<HTMLDivElement>(null);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const updatePosition = React.useCallback(() => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();

        let top = 0;
        let left = 0;

        // Side positioning
        switch (side) {
            case "top":
                top = triggerRect.top - tooltipRect.height - 8;
                break;
            case "bottom":
                top = triggerRect.bottom + 8;
                break;
            case "left":
                left = triggerRect.left - tooltipRect.width - 8;
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                break;
            case "right":
                left = triggerRect.right + 8;
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                break;
        }

        // Align positioning (for top/bottom)
        if (side === "top" || side === "bottom") {
            switch (align) {
                case "start":
                    left = triggerRect.left;
                    break;
                case "center":
                    left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                    break;
                case "end":
                    left = triggerRect.right - tooltipRect.width;
                    break;
            }
        }

        // Viewport boundary checks
        const padding = 8;
        if (left < padding) left = padding;
        if (left + tooltipRect.width > window.innerWidth - padding) {
            left = window.innerWidth - tooltipRect.width - padding;
        }
        if (top < padding) top = triggerRect.bottom + 8; // Flip to bottom
        if (top + tooltipRect.height > window.innerHeight - padding) {
            top = triggerRect.top - tooltipRect.height - 8; // Flip to top
        }

        setPosition({ top, left });
    }, [side, align]);

    const showTooltip = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delayMs);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    };

    React.useEffect(() => {
        if (isVisible) {
            updatePosition();
        }
    }, [isVisible, updatePosition]);

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const childProps = children.props as Record<string, unknown>;

    const childElement = React.cloneElement(children, {
        ref: triggerRef,
        onMouseEnter: (e: React.MouseEvent) => {
            showTooltip();
            if (typeof childProps.onMouseEnter === "function") {
                (childProps.onMouseEnter as (e: React.MouseEvent) => void)(e);
            }
        },
        onMouseLeave: (e: React.MouseEvent) => {
            hideTooltip();
            if (typeof childProps.onMouseLeave === "function") {
                (childProps.onMouseLeave as (e: React.MouseEvent) => void)(e);
            }
        },
        onFocus: (e: React.FocusEvent) => {
            showTooltip();
            if (typeof childProps.onFocus === "function") {
                (childProps.onFocus as (e: React.FocusEvent) => void)(e);
            }
        },
        onBlur: (e: React.FocusEvent) => {
            hideTooltip();
            if (typeof childProps.onBlur === "function") {
                (childProps.onBlur as (e: React.FocusEvent) => void)(e);
            }
        },
        "aria-describedby": isVisible ? "tooltip" : undefined,
    } as React.HTMLAttributes<HTMLElement>);

    return (
        <>
            {childElement}
            {isVisible && (
                <div
                    ref={tooltipRef}
                    id="tooltip"
                    role="tooltip"
                    className={cn(
                        "fixed z-[100] px-3 py-1.5 text-xs font-medium rounded-md",
                        "bg-popover text-popover-foreground border border-border shadow-md",
                        "animate-in fade-in-0 zoom-in-95",
                        className
                    )}
                    style={{
                        top: position.top,
                        left: position.left,
                    }}
                >
                    {content}
                </div>
            )}
        </>
    );
}

export { Tooltip };
export type { TooltipProps };
