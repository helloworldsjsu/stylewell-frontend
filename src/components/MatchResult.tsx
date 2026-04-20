import { getImageUrl } from '../lib/supabase';

interface MatchResultProps {
  top_item: {
    item_id?: string;
    category: string;
    color: string;
    image_url: string;
  };
  bottom_item: {
    item_id?: string;
    category: string;
    color: string;
    image_url: string;
  };
  compatibility_score: number;
  score_breakdown?: {
    style_match: number;
    color_harmony: number;
    occasion_fit: number;
  };
}

export function MatchResult({
  top_item,
  bottom_item,
  compatibility_score,
  score_breakdown,
}: MatchResultProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 80) return 'text-green-700';
    if (score >= 60) return 'text-yellow-700';
    return 'text-red-700';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="grid grid-cols-2 gap-4 p-4">
        <div className="space-y-2">
          <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
            <img
              src={getImageUrl(top_item.image_url)}
              alt={top_item.category}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-center">
            <p className="font-medium">{top_item.category}</p>
            <p className="text-sm text-gray-600 capitalize">{top_item.color}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
            <img
              src={getImageUrl(bottom_item.image_url)}
              alt={bottom_item.category}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-center">
            <p className="font-medium">{bottom_item.category}</p>
            <p className="text-sm text-gray-600 capitalize">{bottom_item.color}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="text-center mb-3">
          <div className={`text-3xl font-bold ${getScoreTextColor(compatibility_score)}`}>
            {Math.round(compatibility_score)}%
          </div>
          <p className="text-sm text-gray-600">Compatibility Score</p>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full ${getScoreColor(compatibility_score)} transition-all duration-500`}
            style={{ width: `${compatibility_score}%` }}
          />
        </div>

        {score_breakdown && (
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Style Match</span>
              <span className="font-medium">{Math.round(score_breakdown.style_match)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Color Harmony</span>
              <span className="font-medium">{Math.round(score_breakdown.color_harmony)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Occasion Fit</span>
              <span className="font-medium">{Math.round(score_breakdown.occasion_fit)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
