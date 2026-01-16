"use client";

import { ThemeProvider } from "better-themes";

export function ClientProvider({ children }: { children: React.ReactNode }) {
    return <ThemeProvider attribute="class" >
        {children}
    </ThemeProvider>;
}
