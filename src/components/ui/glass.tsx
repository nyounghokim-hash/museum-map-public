import { cn } from "@/lib/utils";
import React from "react";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
    intensity?: "light" | "medium" | "heavy";
    gradient?: boolean;
}

export function GlassPanel({ className, intensity = "medium", gradient = false, children, ...props }: GlassPanelProps) {
    const intensityClass = {
        light: "glass-panel",
        medium: "glass-panel",
        heavy: "glass-nav",
    };

    return (
        <div className={cn(`rounded-2xl ${intensityClass[intensity]} ${gradient ? 'gradient-border' : ''}`, className)} {...props}>
            {children}
        </div>
    );
}

export function FilterChip({ active, children, onClick }: { active?: boolean, children: React.ReactNode, onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-3.5 py-2 rounded-full text-[13px] font-medium transition-all whitespace-nowrap",
                active
                    ? "gradient-btn shadow-md"
                    : "glass-panel hover:shadow-md"
            )}
        >
            {children}
        </button>
    );
}
