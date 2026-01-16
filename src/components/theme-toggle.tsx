"use client";

import { useTheme } from "better-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import { SunIcon, MoonIcon, ComputerIcon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="w-10 h-10 rounded-xl bg-secondary/50 animate-pulse border border-border" />
        );
    }

    const themes = [
        { name: "light", icon: SunIcon },
        { name: "dark", icon: MoonIcon },
        { name: "system", icon: ComputerIcon },
    ] as const;

    const currentTheme = themes.find((t) => t.name === theme) || themes[2];

    return (
        <div className="flex items-center gap-1 p-1 bg-secondary/50 backdrop-blur-md rounded-2xl border border-border shadow-sm">
            {themes.map((t) => {
                const isActive = theme === t.name;
                return (
                    <button
                        key={t.name}
                        onClick={() => setTheme(t.name)}
                        className={`
              relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300 group
              ${isActive
                                ? "bg-background text-primary shadow-sm scale-105"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/20"
                            }
            `}
                        aria-label={`Set ${t.name} theme`}
                    >
                        <HugeiconsIcon
                            icon={t.icon}
                            size={18}
                            strokeWidth={2}
                            className={`transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`}
                        />
                        {isActive && (
                            <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary animate-in zoom-in duration-300" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
