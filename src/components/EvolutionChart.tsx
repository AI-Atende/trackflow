import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar } from 'lucide-react';

interface EvolutionChartProps {
    data: any[]; // Expecting array of { date, leads, appointments, sales, revenue }
    loading?: boolean;
}

export const EvolutionChart: React.FC<EvolutionChartProps> = ({ data, loading }) => {
    const [days, setDays] = useState<7 | 15 | 30>(7);

    if (loading) {
        return (
            <div className="w-full h-[350px] bg-card rounded-2xl p-6 border border-border shadow-sm flex items-center justify-center animate-pulse">
                <span className="text-muted-foreground">Carregando dados evolutivos...</span>
            </div>
        );
    }

    // Mock data generation if real data isn't ready yet (for structure validation)
    // In real impl, we filter 'data' based on 'days'
    const chartData = data.slice(-days);

    return (
        <div className="w-full bg-card rounded-2xl p-6 border border-border shadow-sm glass">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                        <Calendar size={18} className="text-brand-500" />
                        Evolução Diária
                    </h3>
                    <p className="text-sm text-muted-foreground">Acompanhe leads, vendas e receita ao longo do tempo.</p>
                </div>
                <div className="flex bg-muted/50 p-1 rounded-lg">
                    {[7, 15, 30].map((d) => (
                        <button
                            key={d}
                            onClick={() => setDays(d as any)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${days === d
                                    ? 'bg-background shadow text-brand-500'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.3} />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
                            tickFormatter={(val) => val.split('/')[0]} // Show only day
                        />
                        <YAxis
                            yAxisId="left"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
                            tickFormatter={(val) => `R$${val / 1000}k`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'var(--color-card)',
                                borderRadius: '8px',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-card-foreground)'
                            }}
                        />
                        <Area
                            yAxisId="right"
                            type="monotone"
                            dataKey="revenue"
                            name="Receita"
                            stroke="#8b5cf6"
                            fillOpacity={1}
                            fill="url(#colorRevenue)"
                            strokeWidth={2}
                        />
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="leads"
                            name="Leads"
                            stroke="#3b82f6"
                            fillOpacity={1}
                            fill="url(#colorLeads)"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
