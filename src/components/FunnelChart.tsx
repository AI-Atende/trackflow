import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AdCampaign } from '../types';
import { Skeleton } from './Skeleton';
import { useToast } from '@/contexts/ToastContext';

interface FunnelChartProps {
  data: AdCampaign[];
  selectedId: string | null;
  journeyLabels?: string[];
  loading?: boolean;
}

export const FunnelChart: React.FC<FunnelChartProps> = ({ data, selectedId, journeyLabels, loading }) => {
  const { showToast } = useToast();

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    showToast(`"${text}" copiado!`, "success");
  };

  if (loading) {
    return (
      <div className="h-[300px] w-full bg-card rounded-xl p-4 border border-border">
        <div className="flex justify-between items-center mb-4 px-2">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="h-[85%] w-full flex items-end justify-between px-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="w-1/6 rounded-t-lg" style={{ height: `${20 + Math.random() * 60}%` }} />
          ))}
        </div>
      </div>
    );
  }

  // Transform data for chart
  // If an ID is selected, show that one. If not, show the aggregate or the first one.
  const activeCampaign = selectedId
    ? data.find(c => c.id === selectedId)
    : data[0];

  if (!activeCampaign) return null;

  const labels = journeyLabels || ["Impressões", "Cliques", "Leads", "Checkout", "Vendas"];

  const chartData = [
    { name: 'I', value: activeCampaign.data.stage1, label: labels[0] || "I" },
    { name: 'II', value: activeCampaign.data.stage2, label: labels[1] || "II" },
    { name: 'III', value: activeCampaign.data.stage3, label: labels[2] || "III" },
    { name: 'IV', value: activeCampaign.data.stage4, label: labels[3] || "IV" },
    { name: 'V', value: activeCampaign.data.stage5, label: labels[4] || "V" },
  ];

  return (
    <div className="h-[300px] w-full bg-card rounded-xl p-4 border border-border glass">
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Funil Visual: <span
            className="text-brand-500 cursor-pointer hover:underline"
            title="Copiar"
            onClick={(e) => handleCopy(e, activeCampaign.name)}
          >
            {activeCampaign.name}
          </span>
        </h3>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--color-card)', borderRadius: '8px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', color: 'var(--color-card-foreground)' }}
            itemStyle={{ color: 'var(--color-card-foreground)' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#22c55e"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorValue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
