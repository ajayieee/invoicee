'use client';

import React from 'react';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 6, className = '' }: SkeletonTableProps) {
  return (
    <div className={`w-full overflow-hidden border border-slate-200 rounded-xl bg-white ${className}`}>
      {/* Header Skeleton */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={`header-${i}`}
            className="h-3.5 bg-slate-200 rounded-md animate-pulse"
            style={{ width: `${Math.floor(60 + (i % 3) * 20)}px` }}
          />
        ))}
      </div>

      {/* Rows Skeleton */}
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={`row-${rIdx}`} className="px-4 py-3.5 flex items-center justify-between gap-4">
            {Array.from({ length: columns }).map((_, cIdx) => (
              <div
                key={`cell-${rIdx}-${cIdx}`}
                className="h-3 bg-slate-150 bg-slate-100 rounded animate-pulse"
                style={{
                  width: cIdx === 0 ? '140px' : cIdx === columns - 1 ? '60px' : `${Math.floor(70 + ((rIdx + cIdx) % 4) * 20)}px`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
