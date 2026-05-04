import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { OccasionPicker } from '../components/OccasionPicker';
import { WardrobeGrid } from '../components/WardrobeGrid';
import { OutfitCard } from '../components/OutfitCard';
import { AIResultsBoundary } from '../components/AIResultsBoundary';
import { MAX_RECOMMENDATIONS } from '../api/recommendationNormalizers';
import { getItemSlot } from '../lib/wardrobeSlots';
import { useOutfitStore } from '../store/outfitStore';
import type { ClothingItem } from '../types/wardrobe';

function ScenarioBadge({
  occasion,
  top,
  bottom,
  other,
}: {
  occasion: string | null;
  top: ClothingItem | null;
  bottom: ClothingItem | null;
  other: ClothingItem | null;
}) {
  const text = useMemo(() => {
    const parts: string[] = [];
    if (occasion) parts.push(`for ${occasion[0].toUpperCase()}${occasion.slice(1)}`);
    if (top) parts.push(`with locked ${top.color} ${top.category}`);
    if (bottom) parts.push(`and ${bottom.color} ${bottom.category}`);
    if (other) parts.push(`plus ${other.color} ${other.category}`);
    return parts.length ? `Showing: Best outfits ${parts.join(' ')}` : 'Showing: Best casual outfits';
  }, [occasion, top, bottom, other]);

  return <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">{text}</p>;
}

function LoadingSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((id) => (
        <div key={id} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 h-5 w-24 rounded bg-slate-200" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-28 rounded-xl bg-slate-200" />
            <div className="h-28 rounded-xl bg-slate-200" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-2 rounded bg-slate-200" />
            <div className="h-2 rounded bg-slate-200" />
            <div className="h-2 rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Matching() {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const {
    wardrobe,
    recommendedOutfits,
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
    findOutfits,
    clearRecommendations,
    clearMatchingCache,
  } = useOutfitStore();

  useEffect(() => {
    fetchWardrobe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const tops = wardrobe.filter((item) => getItemSlot(item) === 'topwear');
  const bottoms = wardrobe.filter((item) => getItemSlot(item) === 'bottomwear');
  const others = wardrobe.filter((item) => getItemSlot(item) === 'others');
  const isWedding = String(selectedOccasion ?? '').trim().toLowerCase() === 'wedding';
  const canRecommend = isWedding
    ? Boolean(lockedOther) || others.length >= 1
    : Boolean(lockedOther) || (tops.length >= 1 && bottoms.length >= 1);

  const controls = (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">What is the occasion?</h2>
        <OccasionPicker selected={selectedOccasion} onChange={setOccasion} />
        <button
          type="button"
          onClick={() => setOccasion(null)}
          className="text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Reset to Casual
        </button>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => {
            findOutfits();
            setMobileDrawerOpen(false);
          }}
          disabled={isLoading || !canRecommend}
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Find Outfits
        </button>
        <button
          type="button"
          onClick={clearRecommendations}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Clear Selection
        </button>
        <button
          type="button"
          onClick={clearMatchingCache}
          className="rounded-xl border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50"
        >
          Clear Cache
        </button>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Lock a top? (optional)</h3>
        <WardrobeGrid
          items={wardrobe}
          filterType="topwear"
          selectedId={lockedTop?.id}
          onSelect={(item) => lockTop(lockedTop?.id === item.id ? null : item)}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Lock a bottom? (optional)</h3>
        <WardrobeGrid
          items={wardrobe}
          filterType="bottomwear"
          selectedId={lockedBottom?.id}
          onSelect={(item) => lockBottom(lockedBottom?.id === item.id ? null : item)}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Lock an other item? (optional)</h3>
        <WardrobeGrid
          items={wardrobe}
          filterType="others"
          selectedId={lockedOther?.id}
          onSelect={(item) => lockOther(lockedOther?.id === item.id ? null : item)}
        />
      </section>
    </div>
  );

  return (
    <div className="pb-24 md:pb-0">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-slate-900">Outfit Matching</h1>
        <p className="text-sm text-slate-600">Find your top {MAX_RECOMMENDATIONS} looks with AI-enhanced scoring.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        <aside className="hidden md:col-span-5 xl:col-span-4 md:block">{controls}</aside>

        <main className="space-y-4 md:col-span-7 xl:col-span-8">
          <ScenarioBadge occasion={selectedOccasion} top={lockedTop} bottom={lockedBottom} other={lockedOther} />

          {!canRecommend && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">
              {isWedding
                ? 'Add at least 1 item in Others to get wedding recommendations.'
                : 'Add at least 1 top and 1 bottom to get pair recommendations, or lock an Others item for a standalone look.'}
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <span>{error}</span>
              <button
                type="button"
                onClick={findOutfits}
                className="rounded-md border border-rose-300 px-2 py-1 font-semibold hover:bg-rose-100"
              >
                Retry
              </button>
            </div>
          )}

          {isLoading && <LoadingSkeletons />}

          {!isLoading && recommendedOutfits.length > 0 && (
            <AIResultsBoundary
              fallback={
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  AI sections failed to render. Showing rule-based scores only.
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recommendedOutfits.slice(0, MAX_RECOMMENDATIONS).map((outfit, index) => (
                  <OutfitCard
                    key={`${outfit.top?.id ?? 'no-top'}-${outfit.bottom?.id ?? 'no-bottom'}-${outfit.other?.id ?? 'no-other'}-${index}`}
                    outfit={outfit}
                    rank={index + 1}
                  />
                ))}
              </div>
            </AIResultsBoundary>
          )}
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white p-3 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] md:hidden">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen((open) => !open)}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Controls
        </button>
        {mobileDrawerOpen && controls}
      </div>
    </div>
  );
}
