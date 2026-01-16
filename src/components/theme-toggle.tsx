"use client";

import { useTheme } from "better-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import { Sun01Icon, Moon02Icon, ComputerIcon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="flex items-center gap-0.5 p-0.5 bg-secondary">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="w-7 h-7 bg-muted animate-pulse" />
                ))}
            </div>
        );
    }

    const themes = [
        { name: "light", icon: Sun01Icon, label: "L" },
        { name: "dark", icon: Moon02Icon, label: "D" },
        { name: "system", icon: ComputerIcon, label: "A" },
    ] as const;

    return (
        <div className="flex items-center gap-0.5 p-0.5 bg-secondary border border-border">
            {themes.map((t) => {
                const isActive = theme === t.name;
                return (
                    <button
                        key={t.name}
                        onClick={() => setTheme(t.name)}
                        className={`
                            relative flex items-center justify-center w-7 h-7 transition-all
                            ${isActive
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }
                        `}
                        aria-label={`Set ${t.name} theme`}
                        title={t.name.charAt(0).toUpperCase() + t.name.slice(1)}
                    >
                        <HugeiconsIcon
                            icon={t.icon}
                            size={14}
                            strokeWidth={1.5}
                        />
                    </button>
                );
            })}
        </div>
    );
}
