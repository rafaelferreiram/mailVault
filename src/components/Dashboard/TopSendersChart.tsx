import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { SenderGroup } from '@shared/types';
import { formatBytes, truncate } from '@/lib/format';

interface Props {
  data: SenderGroup[];
}

export function TopSendersChart({ data }: Props) {
  const chartData = data.map((g) => ({
    name: truncate(g.name || g.email, 22),
    email: g.email,
    bytes: g.totalBytes,
    count: g.count,
  }));

  if (!chartData.length) {
    return (
      <div className="h-56 flex items-center justify-center text-fg-subtle font-mono text-[10px] uppercase tracking-widest">
        NO DATA
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 30, right: 12, top: 0, bottom: 0 }}>
          <XAxis
            type="number"
            tick={{ fill: '#4a5568', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
            tickFormatter={(v) => formatBytes(v, { compact: true })}
            axisLine={{ stroke: '#1e2530' }}
            tickLine={{ stroke: '#1e2530' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fill: '#7d8694', fontSize: 11 }}
            axisLine={{ stroke: '#1e2530' }}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(0,212,255,0.06)' }}
            contentStyle={{
              background: '#0f1318',
              border: '1px solid #1e2530',
              borderRadius: 0,
              fontFamily: 'IBM Plex Mono',
              fontSize: 11,
            }}
            labelStyle={{ color: '#e8edf3', fontWeight: 600 }}
            itemStyle={{ color: '#00d4ff' }}
            formatter={(value: number, _name, payload) => [
              `${formatBytes(value)} · ${payload.payload.count} msgs`,
              'Storage',
            ]}
          />
          <Bar dataKey="bytes">
            {chartData.map((_, i) => (
              <Cell key={i} fill="#00d4ff" fillOpacity={0.85 - i * 0.05} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
