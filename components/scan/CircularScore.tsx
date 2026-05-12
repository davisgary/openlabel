'use client';
import React from 'react';
import { ratingStroke } from './utils';

export default function CircularScore({ score, size = 56, stroke = 6, label, labelClass }: { score: number; size?: number; stroke?: number; label?: string; labelClass?: string }) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - Math.max(0, Math.min(1, score / 100)));
  const fontSize = Math.max(12, Math.round(size * 0.36));
  const labelFontSize = Math.max(9, Math.round(size * 0.16));
  return (
    <div className={`relative inline-flex items-center justify-center ${ratingStroke(score)}`} style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={stroke} className="opacity-10" fill="none" />
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" fill="none"
            strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset} />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-sm font-semibold text-primary-foreground" style={{ fontSize }}>
        <div style={{ lineHeight: 1 }}>{score}</div>
        {label && (
          <div className={labelClass} style={{ fontSize: labelFontSize, lineHeight: 1 }}>{label}</div>
        )}
      </div>
    </div>
  );
}
