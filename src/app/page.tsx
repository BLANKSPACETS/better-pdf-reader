import { ComponentExample } from "@/components/component-example";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Page() {
    return (
        <main className="min-h-screen bg-background transition-colors duration-500">
            <div className="fixed top-6 right-6 z-50">
                <ThemeToggle />
            </div>
            <ComponentExample />
        </main>
    );
}