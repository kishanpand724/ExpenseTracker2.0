import React from "react";
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  BarChart as RechartsBarChart,
  AreaChart as RechartsAreaChart,
  Line as RechartsLine,
  Bar as RechartsBar,
  Area as RechartsArea,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid as RechartsCartesianGrid,
  ReferenceArea as RechartsReferenceArea,
  Legend as RechartsLegend,
} from "recharts";

// Bklit UI LineChart wrapper
export const LineChart: React.FC<
  React.ComponentProps<typeof RechartsLineChart> & {
    className?: string;
    children?: React.ReactNode;
    responsive?: boolean;
    height?: number | string;
    width?: number | string;
  }
> = ({ className, children, responsive = true, width = "100%", height = 300, ...props }) => {
  if (responsive) {
    const h = typeof height === "number" ? `${height}px` : (height || "100%");
    return (
      <div className={className} style={{ width: "100%", height: h, minHeight: "250px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart {...props}>{children}</RechartsLineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div className={className}>
      <RechartsLineChart width={typeof width === "number" ? width : 500} height={typeof height === "number" ? height : 300} {...props}>
        {children}
      </RechartsLineChart>
    </div>
  );
};

// Bklit UI XAxis wrapper
export const XAxis: React.FC<React.ComponentProps<typeof RechartsXAxis> & { className?: string }> = ({
  tickLine = false,
  axisLine = false,
  ...props
}) => {
  return (
    <RechartsXAxis
      tickLine={tickLine}
      axisLine={axisLine}
      tick={{ fontSize: 12, fill: "#64748b" }}
      {...(props as any)}
    />
  );
};

// Bklit UI YAxis wrapper
export const YAxis: React.FC<React.ComponentProps<typeof RechartsYAxis> & { className?: string }> = ({
  tickLine = false,
  axisLine = false,
  ...props
}) => {
  return (
    <RechartsYAxis
      tickLine={tickLine}
      axisLine={axisLine}
      tick={{ fontSize: 12, fill: "#64748b" }}
      {...(props as any)}
    />
  );
};

// Bklit UI ChartTooltip wrapper
export const ChartTooltip: React.FC<React.ComponentProps<typeof RechartsTooltip> & { className?: string }> = ({
  ...props
}) => {
  return (
    <RechartsTooltip
      contentStyle={{
        backgroundColor: "#1e293b",
        borderColor: "#334155",
        borderRadius: "0.5rem",
        color: "#f8fafc",
        fontSize: "0.875rem",
        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
        ...(props.contentStyle || {}),
      }}
      itemStyle={{ color: "#f8fafc", ...(props.itemStyle || {}) }}
      {...(props as any)}
    />
  );
};

// Bklit UI Grid (CartesianGrid) wrapper
export const Grid: React.FC<React.ComponentProps<typeof RechartsCartesianGrid> & { className?: string }> = ({
  strokeDasharray = "3 3",
  stroke = "#e2e8f0",
  vertical = false,
  ...props
}) => {
  return (
    <RechartsCartesianGrid
      strokeDasharray={strokeDasharray}
      stroke={stroke}
      vertical={vertical}
      {...(props as any)}
    />
  );
};

// Bklit UI ReferenceArea wrapper
export const ReferenceArea: React.FC<React.ComponentProps<typeof RechartsReferenceArea> & { className?: string }> = ({
  strokeOpacity = 0.3,
  fill = "#3b82f6",
  fillOpacity = 0.1,
  ...props
}) => {
  return (
    <RechartsReferenceArea
      strokeOpacity={strokeOpacity}
      fill={fill}
      fillOpacity={fillOpacity}
      {...(props as any)}
    />
  );
};

// Bklit UI Line wrapper
export const Line: React.FC<React.ComponentProps<typeof RechartsLine> & { className?: string }> = ({
  type = "monotone",
  stroke = "#2563eb",
  strokeWidth = 2,
  dot = false,
  activeDot = { r: 6 },
  ...props
}) => {
  return (
    <RechartsLine
      type={type}
      stroke={stroke}
      strokeWidth={strokeWidth}
      dot={dot}
      activeDot={activeDot}
      {...(props as any)}
    />
  );
};

// Additional Bklit UI exports
export const BarChart = RechartsBarChart;
export const AreaChart = RechartsAreaChart;
export const Bar = RechartsBar;
export const Area = RechartsArea;
export const Legend = RechartsLegend;
export const ChartContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`w-full h-full ${className || ""}`}>{children}</div>
);
