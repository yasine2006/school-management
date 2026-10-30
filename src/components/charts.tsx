"use client";

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function EnrollmentChart({ data }: { data: { month: string; count: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 224 }}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="enroll" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f6bff" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#2f6bff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ebf3" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b7a93" }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b7a93" }} />
          <Tooltip
            cursor={{ stroke: "#cbd5e1" }}
            formatter={(v) => [`${v} inscriptions`, ""]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e6ebf3", fontSize: 12 }}
          />
          <Area isAnimationActive={false} type="monotone" dataKey="count" stroke="#2f6bff" strokeWidth={2} fill="url(#enroll)" dot={{ r: 3, fill: "#2f6bff", strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export type Slice = { name: string; value: number; color: string };

export function LevelDonut({ data, total }: { data: Slice[]; total: number }) {
  return (
    <div className="relative mx-auto h-44 w-44">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 176, height: 176 }}>
        <PieChart>
          <Pie isAnimationActive={false} data={data} dataKey="value" innerRadius={56} outerRadius={80} paddingAngle={2} stroke="none">
            {data.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v} élèves`, n]} contentStyle={{ borderRadius: 8, border: "1px solid #e6ebf3", fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold leading-none">{total}</span>
        <span className="mt-1 text-xs text-muted">élèves</span>
      </div>
    </div>
  );
}
