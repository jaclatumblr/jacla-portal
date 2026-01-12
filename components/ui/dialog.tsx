"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
};

type DialogContentProps = {
    children: React.ReactNode;
    className?: string;
    title?: string;
    description?: string;
    showCloseButton?: boolean;
};

const DialogContext = React.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
} | null>(null);

function Dialog({ open, onOpenChange, children }: DialogProps) {
    // Escapeで閉じる
    React.useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onOpenChange(false);
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onOpenChange]);

    // body scrollを防ぐ
    React.useEffect(() => {
        if (open) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [open]);

    return (
        <DialogContext.Provider value={{ open, onOpenChange }}>
            {children}
        </DialogContext.Provider>
    );
}

function DialogTrigger({
    children,
    asChild,
}: {
    children: React.ReactNode;
    asChild?: boolean;
}) {
    const context = React.useContext(DialogContext);
    if (!context) throw new Error("DialogTrigger must be used within Dialog");

    if (asChild && React.isValidElement(children)) {
        const childProps = children.props as { onClick?: (e: React.MouseEvent) => void };
        const existingOnClick = childProps.onClick;
        return React.cloneElement(children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
            onClick: (e: React.MouseEvent) => {
                existingOnClick?.(e);
                context.onOpenChange(true);
            },
        });
    }

    return (
        <button type="button" onClick={() => context.onOpenChange(true)}>
            {children}
        </button>
    );
}

function DialogContent({
    children,
    className,
    title,
    description,
    showCloseButton = true,
}: DialogContentProps) {
    const context = React.useContext(DialogContext);
    if (!context) throw new Error("DialogContent must be used within Dialog");

    if (!context.open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0"
                onClick={() => context.onOpenChange(false)}
                aria-hidden="true"
            />

            {/* Content */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? "dialog-title" : undefined}
                aria-describedby={description ? "dialog-description" : undefined}
                className={cn(
                    "relative z-50 w-full max-w-lg mx-4 rounded-lg border border-border bg-card p-6 shadow-lg",
                    "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4",
                    className
                )}
            >
                {showCloseButton && (
                    <button
                        type="button"
                        onClick={() => context.onOpenChange(false)}
                        className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="閉じる"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}

                {title && (
                    <h2 id="dialog-title" className="text-lg font-semibold text-foreground mb-2">
                        {title}
                    </h2>
                )}

                {description && (
                    <p id="dialog-description" className="text-sm text-muted-foreground mb-4">
                        {description}
                    </p>
                )}

                {children}
            </div>
        </div>
    );
}

function DialogHeader({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex flex-col space-y-1.5 mb-4", className)}>
            {children}
        </div>
    );
}

function DialogTitle({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <h2 className={cn("text-lg font-semibold text-foreground", className)}>
            {children}
        </h2>
    );
}

function DialogDescription({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <p className={cn("text-sm text-muted-foreground", className)}>
            {children}
        </p>
    );
}

function DialogFooter({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6", className)}>
            {children}
        </div>
    );
}

function DialogClose({
    children,
    asChild,
}: {
    children: React.ReactNode;
    asChild?: boolean;
}) {
    const context = React.useContext(DialogContext);
    if (!context) throw new Error("DialogClose must be used within Dialog");

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
            onClick: () => context.onOpenChange(false),
        });
    }

    return (
        <button type="button" onClick={() => context.onOpenChange(false)}>
            {children}
        </button>
    );
}

export {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
};
