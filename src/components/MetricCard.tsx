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
      <div className="p-6 bg-card border border-border rounded-2xl shadow-sm">
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 glass">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {tooltip ? (
          <Tooltip content={tooltip} position="bottom">
            <span className="cursor-help border-b border-dotted border-muted-foreground/50">{metric.label}</span>
          </Tooltip>
        ) : (
          metric.label
        )}
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <h3 className="text-2xl font-bold text-card-foreground">{metric.value}</h3>
        <div className="flex items-center text-sm font-medium text-brand-600">
          {metric.trend === 'up' && <ArrowUpRight size={16} className="mr-1" />}
          {metric.trend === 'down' && <ArrowDownRight size={16} className="mr-1" />}
          {metric.trend === 'neutral' && <Minus size={16} className="mr-1" />}
          <span>{metric.percentage}</span>
        </div>
      </div>
    </div>
  );
};
