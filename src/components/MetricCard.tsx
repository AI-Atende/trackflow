import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { MetricSummary } from '../types';
import { Skeleton } from './Skeleton';
import { Tooltip } from './Tooltip';

interface MetricCardProps {
  metric: MetricSummary;
  loading?: boolean;
  tooltip?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ metric, loading, tooltip }) => {
  if (loading) {
    return (
      <div className="p-4 bg-card border border-border rounded-xl shadow-sm">
        <Skeleton className="h-3 w-20 mb-3" />
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 glass">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {tooltip ? (
          <Tooltip content={tooltip} position="bottom">
            <span className="cursor-help border-b border-dotted border-muted-foreground/50">{metric.label}</span>
          </Tooltip>
        ) : (
          metric.label
        )}
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <h3 className="text-xl font-bold text-card-foreground">{metric.value}</h3>
        <div className="flex items-center text-xs font-medium text-brand-600">
          {metric.trend === 'up' && <ArrowUpRight size={14} className="mr-0.5" />}
          {metric.trend === 'down' && <ArrowDownRight size={14} className="mr-0.5" />}
          {metric.trend === 'neutral' && <Minus size={14} className="mr-0.5" />}
          <span>{metric.percentage}</span>
        </div>
      </div>
    </div>
  );
};
