import { Lightbulb, Save } from 'lucide-react';
import type { ClothingItem, ScoredOutfit } from '../types/wardrobe';
import { ScoreBar } from './ScoreBar';

interface OutfitCardProps {
  outfit: ScoredOutfit;
  rank: number;
  onSave?: () => void;
  size?: 'large' | 'small';
}

export function OutfitCard({ outfit, rank, onSave, size = 'small' }: OutfitCardProps) {
  const large = size === 'large';
  const slots = [outfit.top, outfit.bottom, outfit.other].filter(
    (item): item is Pick<ClothingItem, 'id' | 'category' | 'color' | 'image_url'> => Boolean(item),
  );

  return (
    <article className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${large ? 'space-y-4' : 'space-y-3'}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">#{rank}</h3>
        <p className="text-lg font-bold text-slate-900">{Math.round(outfit.score)}/100</p>
      </div>

      <div className={`grid ${slots.length >= 3 ? 'grid-cols-3' : slots.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${large ? 'gap-4' : 'gap-3'}`}>
        {slots.map((item) => (
          <div key={item.id}>
            <img
              src={item.image_url}
              alt={`${item.color} ${item.category}`}
              loading="lazy"
              className={`w-full rounded-xl bg-slate-100 p-1 object-contain ${large ? 'h-52' : 'h-36'}`}
            />
            <p className="mt-1 text-sm font-medium text-slate-800">{item.color} {item.category}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <ScoreBar label="Color" score={outfit.breakdown.color} color="#0ea5e9" />
        <ScoreBar label="Style" score={outfit.breakdown.style} color="#10b981" />
        <ScoreBar label="Occasion" score={outfit.breakdown.occasion} color="#f59e0b" />
      </div>

      <p className="text-sm text-slate-700">"{outfit.ai_reason}"</p>
      <p className="flex items-center gap-2 text-sm text-amber-800">
        <Lightbulb className="h-4 w-4" />
        {outfit.ai_tip}
      </p>

      {onSave && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      )}
    </article>
  );
}
