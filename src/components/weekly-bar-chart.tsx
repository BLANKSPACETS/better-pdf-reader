"use client";

import * as React from "react";
import { SVGProps } from "react";
import { Bar, BarChart, XAxis } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

interface WeeklyBarChartProps {
    data: number[];
    className?: string;
}

const chartConfig = {
    minutes: {
        label: "Minutes",
        color: "var(--foreground)",
    },
} satisfies ChartConfig;

export function WeeklyBarChart({ data, className }: WeeklyBarChartProps) {
    const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined);
    const [todayIdx, setTodayIdx] = React.useState<number>(-1);

    React.useEffect(() => {
        const day = new Date().getDay();
        setTodayIdx(day === 0 ? 6 : day - 1);
    }, []);

    const chartData = React.useMemo(() => {
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        return days.map((day, i) => ({
            day,
            minutes: data[i] ?? 0,
            isToday: i === todayIdx,
        }));
    }, [data, todayIdx]);

    const activeData = React.useMemo(() => {
        if (activeIndex === undefined) return null;
        return chartData[activeIndex];
    }, [activeIndex, chartData]);

    const peak = Math.max(...data, 1);
    const total = data.reduce((a, b) => a + b, 0);

    return (
        <div className={cn("flex flex-col gap-2", className)}>
            {/* Header stats */}
            <div className="flex items-baseline justify-between">
                <div className="text-lg font-bold tracking-tighter">
                    {activeData ? `${activeData.minutes}m` : `${total}m`}
                </div>
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
                    {activeData ? activeData.day : "This Week"}
                </div>
            </div>

            {/* Chart */}
            <AnimatePresence mode="wait">
                <ChartContainer config={chartConfig} className="h-20 w-full">
                    <BarChart
                        data={chartData}
                        onMouseLeave={() => setActiveIndex(undefined)}
                        margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                    >
                        <XAxis
                            dataKey="day"
                            tickLine={false}
                            tickMargin={4}
                            axisLine={false}
                            tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                            tickFormatter={(v) => v.charAt(0)}
                        />
                        <Bar
                            dataKey="minutes"
                            fill="var(--foreground)"
                            shape={
                                <CustomBar
                                    setActiveIndex={setActiveIndex}
                                    activeIndex={activeIndex}
                                    todayIdx={todayIdx}
                                />
                            }
                        />
                    </BarChart>
                </ChartContainer>
            </AnimatePresence>

            {/* Peak info */}
            <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
                <span>Peak {peak}m</span>
                <span>Avg {Math.round(total / 7)}m</span>
            </div>
        </div>
    );
}

interface CustomBarProps extends SVGProps<SVGSVGElement> {
    setActiveIndex: (index?: number) => void;
    index?: number;
    activeIndex?: number;
    todayIdx?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any;
}

const CustomBar = (props: CustomBarProps) => {
    const { x, y, width, height, index, activeIndex, todayIdx, payload } = props;

    const xPos = Number(x || 0);
    const realWidth = Number(width || 0);
    const isActive = index === activeIndex;
    const isToday = index === todayIdx;
    const collapsedWidth = 3;

    const barX = isActive ? xPos : xPos + (realWidth - collapsedWidth) / 2;

    const fill = isToday ? "#ef4444" : isActive ? "var(--foreground)" : "var(--muted-foreground)";

    return (
        <g onMouseEnter={() => props.setActiveIndex(index)}>
            <motion.rect
                style={{ willChange: "transform, width" }}
                y={y}
                initial={{ width: collapsedWidth, x: barX }}
                animate={{
                    width: isActive ? realWidth : collapsedWidth,
                    x: isActive ? xPos : barX,
                }}
                transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
                height={height}
                fill={fill}
                rx={1}
            />
            {isActive && payload && (
                <motion.text
                    style={{ willChange: "transform, opacity" }}
                    className="font-mono text-[10px]"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    x={xPos + realWidth / 2}
                    y={Number(y) - 4}
                    textAnchor="middle"
                    fill={fill}
                >
                    {payload.minutes}
                </motion.text>
            )}
        </g>
    );
};
