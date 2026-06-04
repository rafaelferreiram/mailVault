import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import type { MonthlyVolume } from '@/lib/grouping';

export function VolumeTrendChart({ data }: { data: MonthlyVolume[] }) {
  if (!data.length) {
    return (
      <div className="h-56 flex items-center justify-center text-fg-subtle font-mono text-[10px] uppercase tracking-widest">
        NO DATA
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: '#4a5568', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
            axisLine={{ stroke: '#1e2530' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#4a5568', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
            axisLine={{ stroke: '#1e2530' }}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: '#0f1318',
              border: '1px solid #1e2530',
              borderRadius: 0,
              fontFamily: 'IBM Plex Mono',
              fontSize: 11,
            }}
            labelStyle={{ color: '#e8edf3' }}
            itemStyle={{ color: '#00d4ff' }}
          />
          <Area type="monotone" dataKey="count" stroke="none" fill="url(#volumeGrad)" />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#00d4ff"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: '#00d4ff' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
