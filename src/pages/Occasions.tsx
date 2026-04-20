import { useEffect, useState } from 'react';
import { OutfitCard } from '../components/OutfitCard';
import { OccasionPicker } from '../components/OccasionPicker';
import { ShoppingSuggestionCard } from '../components/ShoppingSuggestionCard';
import { WardrobeGrid } from '../components/WardrobeGrid';
import { AIResultsBoundary } from '../components/AIResultsBoundary';
import { useOutfitStore } from '../store/outfitStore';

export function Occasions() {
  const [showLocks, setShowLocks] = useState(false);
  const {
    wardrobe,
    recommendedOutfits,
    shoppingSuggestions,
    isLoading,
    error,
    selectedOccasion,
    lockedTop,
    lockedBottom,
    lockedOther,
    setOccasion,
    lockTop,
    lockBottom,
    lockOther,
    fetchWardrobe,
    getOccasionOutfit,
    saveOutfit,
  } = useOutfitStore();

  useEffect(() => {
    fetchWardrobe();
  }, [fetchWardrobe]);

  const best = recommendedOutfits[0] ?? null;
  const alternatives = recommendedOutfits.slice(1, 3);

  return (
    <div className="space-y-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Occasion Recommendations</h1>
        <p className="text-sm text-slate-600">Pick an event and get a complete look plus shopping gaps.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Select Occasion</h2>
        <OccasionPicker selected={selectedOccasion} onChange={setOccasion} />
        <button
          type="button"
          onClick={getOccasionOutfit}
          disabled={!selectedOccasion || isLoading}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Get Recommendation
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowLocks((prev) => !prev)}
          className="w-full text-left text-base font-semibold text-slate-900"
        >
          Already have something in mind? {showLocks ? 'Hide' : 'Show'}
        </button>

        {showLocks && (
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Lock Top</h3>
              <WardrobeGrid
                items={wardrobe}
                filterType="topwear"
                selectedId={lockedTop?.id}
                onSelect={(item) => lockTop(lockedTop?.id === item.id ? null : item)}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Lock Bottom</h3>
              <WardrobeGrid
                items={wardrobe}
                filterType="bottomwear"
                selectedId={lockedBottom?.id}
                onSelect={(item) => lockBottom(lockedBottom?.id === item.id ? null : item)}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Lock Other</h3>
              <WardrobeGrid
                items={wardrobe}
                filterType="others"
                selectedId={lockedOther?.id}
                onSelect={(item) => lockOther(lockedOther?.id === item.id ? null : item)}
              />
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
          AI is processing your outfit recommendation...
        </div>
      )}

      {!isLoading && best && (
        <AIResultsBoundary
          fallback={
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              AI sections failed to render. Showing rule-based scores only.
            </div>
          }
        >
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">
              Best Outfit for {selectedOccasion?.charAt(0).toUpperCase()}{selectedOccasion?.slice(1)}
            </h2>
            <OutfitCard outfit={best} rank={1} size="large" onSave={() => saveOutfit(best)} />
          </section>

          {alternatives.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Alternatives</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {alternatives.map((outfit, index) => (
                  <OutfitCard
                    key={`${outfit.top?.id ?? 'no-top'}-${outfit.bottom?.id ?? 'no-bottom'}-${outfit.other?.id ?? 'no-other'}-${index}`}
                    outfit={outfit}
                    rank={index + 2}
                    onSave={() => saveOutfit(outfit)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Shopping Suggestions</h3>
            {shoppingSuggestions.length === 0 ? (
              <p className="text-sm text-slate-600">No shopping suggestions needed for this occasion right now.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {shoppingSuggestions.map((suggestion, index) => (
                  <ShoppingSuggestionCard key={`${suggestion.search_query}-${index}`} suggestion={suggestion} />
                ))}
              </div>
            )}
          </section>
        </AIResultsBoundary>
      )}
    </div>
  );
}
