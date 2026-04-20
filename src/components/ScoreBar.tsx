import { useEffect, useState } from 'react';

interface ScoreBarProps {
  label: string;
  score: number;
  color: string;
}

export function ScoreBar({ label, score, color }: ScoreBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setWidth(Math.max(0, Math.min(100, score)));
    });
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold text-slate-800">{Math.round(score)}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
