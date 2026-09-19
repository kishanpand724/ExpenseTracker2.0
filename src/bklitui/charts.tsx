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

// Bklit UI PieChart Component Suite
export interface PieChartItem {
  label: string;
  value: number;
  color?: string;
}

interface PieChartContextType {
  data: PieChartItem[];
  innerRadius: number;
  size: number;
  totalValue: number;
  hoveredIndex: number | null;
  setHoveredIndex: (idx: number | null) => void;
  colors: string[];
}

const DEFAULT_PIE_COLORS = [
  "#f59e0b",
  "#3b82f6",
  "#ec4899",
  "#ef4444",
  "#8b5cf6",
  "#10b981",
  "#06b6d4",
  "#6366f1",
  "#64748b",
];

const PieChartContext = React.createContext<PieChartContextType | null>(null);

function getArcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngleDeg: number,
  endAngleDeg: number
) {
  const startRad = (startAngleDeg * Math.PI) / 180;
  const endRad = (endAngleDeg * Math.PI) / 180;

  const x1Outer = cx + rOuter * Math.cos(startRad);
  const y1Outer = cy + rOuter * Math.sin(startRad);
  const x2Outer = cx + rOuter * Math.cos(endRad);
  const y2Outer = cy + rOuter * Math.sin(endRad);

  const x1Inner = cx + rInner * Math.cos(endRad);
  const y1Inner = cy + rInner * Math.sin(endRad);
  const x2Inner = cx + rInner * Math.cos(startRad);
  const y2Inner = cy + rInner * Math.sin(startRad);

  const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0;

  return [
    `M ${x1Outer} ${y1Outer}`,
    `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}`,
    `L ${x1Inner} ${y1Inner}`,
    `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${x2Inner} ${y2Inner}`,
    "Z",
  ].join(" ");
}

export const PieChart: React.FC<{
  data: PieChartItem[];
  innerRadius?: number;
  size?: number;
  children?: React.ReactNode;
  className?: string;
  colors?: string[];
}> = ({ data, innerRadius = 60, size = 200, children, className, colors = DEFAULT_PIE_COLORS }) => {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const totalValue = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  return (
    <PieChartContext.Provider
      value={{
        data,
        innerRadius,
        size,
        totalValue,
        hoveredIndex,
        setHoveredIndex,
        colors,
      }}
    >
      <div
        className={className}
        style={{
          position: "relative",
          width: size,
          height: size,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {children}
        </svg>
      </div>
    </PieChartContext.Provider>
  );
};

export const PieSlice: React.FC<{
  index: number;
  color?: string;
}> = ({ index, color }) => {
  const ctx = React.useContext(PieChartContext);
  if (!ctx) return null;

  const { data, innerRadius, size, totalValue, hoveredIndex, setHoveredIndex, colors } = ctx;
  if (totalValue <= 0 || !data[index]) return null;

  let startAngle = -90;
  for (let i = 0; i < index; i++) {
    const val = Number(data[i].value) || 0;
    startAngle += (val / totalValue) * 360;
  }

  const currentVal = Number(data[index].value) || 0;
  let sweep = (currentVal / totalValue) * 360;
  if (sweep >= 360) sweep = 359.999;

  const endAngle = startAngle + sweep;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 8;
  const isHovered = hoveredIndex === index;
  const currentOuterR = isHovered ? outerRadius + 3 : outerRadius;

  const sliceColor = color || data[index].color || colors[index % colors.length];
  const pathD = getArcPath(cx, cy, currentOuterR, innerRadius, startAngle, endAngle);

  return (
    <path
      d={pathD}
      fill={sliceColor}
      style={{
        transition: "all 0.2s ease-in-out",
        cursor: "pointer",
        opacity: hoveredIndex === null || isHovered ? 1 : 0.7,
      }}
      onMouseEnter={() => setHoveredIndex(index)}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <title>{`${data[index].label}: ₹${Number(data[index].value).toLocaleString("en-IN")}`}</title>
    </path>
  );
};

export const PieCenter: React.FC<{
  defaultLabel?: string;
}> = ({ defaultLabel = "Total" }) => {
  const ctx = React.useContext(PieChartContext);
  if (!ctx) return null;

  const { data, totalValue, hoveredIndex, size } = ctx;
  const cx = size / 2;
  const cy = size / 2;

  let displayLabel = defaultLabel;
  let displayValue = "₹" + Math.round(totalValue).toLocaleString("en-IN");

  if (hoveredIndex !== null && data[hoveredIndex]) {
    displayLabel = data[hoveredIndex].label;
    displayValue = "₹" + Math.round(data[hoveredIndex].value).toLocaleString("en-IN");
  }

  return (
    <g>
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: "11px", fontWeight: 600, fill: "#64748b" }}
      >
        {displayLabel}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: "13px", fontWeight: 800, fill: "#0f172a" }}
      >
        {displayValue}
      </text>
    </g>
  );
};
