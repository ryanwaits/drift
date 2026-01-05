'use client';

import { Award, Target, TrendingDown, TrendingUp } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../../lib/utils';
import type { CoverageInsight } from './types';

interface InsightsPanelProps {
  insights: CoverageInsight[];
  className?: string;
}

const insightIcons: Record<CoverageInsight['type'], React.ElementType> = {
  improvement: TrendingUp,
  regression: TrendingDown,
  prediction: Target,
  milestone: Award,
};

const insightColors: Record<CoverageInsight['severity'] & string, string> = {
  info: 'text-muted-foreground',
  warning: 'text-warning',
  success: 'text-success',
};

export function InsightsPanel({ insights, className }: InsightsPanelProps) {
  if (insights.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Insights
      </h4>
      <div className="space-y-1.5">
        {insights.map((insight) => {
          const Icon = insightIcons[insight.type];
          const colorClass = insightColors[insight.severity || 'info'];

          return (
            <div
              key={`${insight.type}-${insight.message}`}
              className={cn('flex items-start gap-2 text-sm', colorClass)}
            >
              <Icon className="size-4 mt-0.5 shrink-0" />
              <span className="text-foreground">{insight.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
