import type { ShoppingSuggestion } from '../types/wardrobe';

interface ShoppingSuggestionCardProps {
  suggestion: ShoppingSuggestion;
}

export function ShoppingSuggestionCard({ suggestion }: ShoppingSuggestionCardProps) {
  const query = `buy ${suggestion.search_query}`.trim();
  const href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-base font-semibold text-slate-900">
        {suggestion.color} {suggestion.pattern} {suggestion.category}
      </h4>
      <p className="mt-2 text-sm text-slate-600">{suggestion.reason}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Search Online
      </a>
    </div>
  );
}
