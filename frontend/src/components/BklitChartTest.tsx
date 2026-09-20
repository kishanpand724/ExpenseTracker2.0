import React from "react";
import { LineChart, XAxis, ChartTooltip, Grid, ReferenceArea, Line } from "../bklitui/charts";

interface BklitChartTestProps {
  data?: Array<{ date: string; value: number }>;
}

export const BklitChartTest: React.FC<BklitChartTestProps> = ({
  data = [
    { date: "Jan", value: 400 },
    { date: "Feb", value: 300 },
    { date: "Mar", value: 600 },
    { date: "Apr", value: 800 },
    { date: "May", value: 500 },
  ],
}) => {
  return (
    <div className="w-full h-64 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
      <LineChart data={data} height={200}>
        <Grid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <ChartTooltip />
        <ReferenceArea x1="Feb" x2="Apr" fill="#3b82f6" fillOpacity={0.1} />
        <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} />
      </LineChart>
    </div>
  );
};

export default BklitChartTest;
