import { useMemo } from 'react';
import { ArrowRight, ArrowUpRight, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { getItemSlot } from '../lib/wardrobeSlots';
import { useWardrobeStore } from '../store/wardrobeStore';
import type { ClothingItem } from '../store/wardrobeStore';

type UploadCategory = 'topwear' | 'bottomwear' | 'shoes' | 'others';

type RecentUpload = {
  id: string;
  imageUrl: string;
  category: UploadCategory;
  color: string;
};

type OutfitSuggestion = {
  id: string;
  name: string;
  occasion: string;
  rating: number;
  accent: string;
  layout: 'combo' | 'standalone';
  items: {
    top?: RecentUpload;
    bottom?: RecentUpload;
    shoes?: RecentUpload;
    other?: RecentUpload;
  };
};

const SHOES_PATTERN = /(shoe|sneaker|boot|heel|loafer|sandal|trainer|footwear)/i;

const mockRecentUploads: RecentUpload[] = [
  {
    id: 'mock-top-1',
    imageUrl:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
    category: 'topwear',
    color: 'white',
  },
  {
    id: 'mock-bottom-1',
    imageUrl:
      'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80',
    category: 'bottomwear',
    color: 'denim',
  },
  {
    id: 'mock-shoes-1',
    imageUrl:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
    category: 'shoes',
    color: 'black',
  },
  {
    id: 'mock-top-2',
    imageUrl:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80',
    category: 'topwear',
    color: 'black',
  },
  {
    id: 'mock-bottom-2',
    imageUrl:
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80',
    category: 'bottomwear',
    color: 'charcoal',
  },
  {
    id: 'mock-shoes-2',
    imageUrl:
      'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=800&q=80',
    category: 'shoes',
    color: 'taupe',
  },
  {
    id: 'mock-other-1',
    imageUrl:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80',
    category: 'others',
    color: 'ivory',
  },
];

const OUTFIT_PRESETS = [
  {
    name: 'Casual Street Fit',
    occasion: 'Casual',
    rating: 8.7,
    accent: 'from-pink-200/70 via-purple-200/60 to-blue-200/70',
  },
  {
    name: 'Soft Office Edit',
    occasion: 'Office',
    rating: 9.1,
    accent: 'from-amber-200/70 via-rose-200/60 to-sky-200/70',
  },
  {
    name: 'Night Luxe Set',
    occasion: 'Party',
    rating: 8.9,
    accent: 'from-indigo-200/70 via-fuchsia-200/60 to-cyan-200/70',
  },
  {
    name: 'Weekend Coffee Run',
    occasion: 'Casual',
    rating: 8.4,
    accent: 'from-emerald-200/70 via-teal-200/60 to-blue-200/70',
  },
  {
    name: 'Gallery Opening',
    occasion: 'Formal',
    rating: 9.0,
    accent: 'from-rose-200/70 via-orange-200/60 to-violet-200/70',
  },
];

const cardVariants = {
  rest: { y: 0 },
  hover: { y: -4 },
};

const imageVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.03 },
};

const pickItem = (items: RecentUpload[], index: number) => items[index % items.length];

const inferUploadCategory = (item: ClothingItem): UploadCategory => {
  const slot = getItemSlot(item);
  if (slot === 'topwear' || slot === 'bottomwear') return slot;
  const text = `${item.type ?? ''} ${item.category ?? ''}`;
  return SHOES_PATTERN.test(text) ? 'shoes' : 'others';
};

const buildOutfits = (uploads: RecentUpload[]) => {
  const maxCards = 5;
  let source = uploads.length ? uploads : mockRecentUploads;
  let tops = source.filter((item) => item.category === 'topwear');
  let bottoms = source.filter((item) => item.category === 'bottomwear');
  let shoes = source.filter((item) => item.category === 'shoes');
  let others = source.filter((item) => item.category === 'others');

  const hasTopBottomPair = tops.length > 0 && bottoms.length > 0;
  const hasOthers = others.length > 0;

  if (!hasTopBottomPair && !hasOthers) {
    source = mockRecentUploads;
    tops = source.filter((item) => item.category === 'topwear');
    bottoms = source.filter((item) => item.category === 'bottomwear');
    shoes = source.filter((item) => item.category === 'shoes');
    others = source.filter((item) => item.category === 'others');
  }

  const comboCount = tops.length > 0 && bottoms.length > 0
    ? Math.min(maxCards, Math.max(1, Math.min(tops.length, bottoms.length)))
    : 0;
  const otherCount = others.length > 0
    ? Math.min(maxCards - comboCount, others.length)
    : 0;

  const outfits: OutfitSuggestion[] = [];

  for (let index = 0; index < comboCount; index += 1) {
    const preset = OUTFIT_PRESETS[index % OUTFIT_PRESETS.length];
    const top = pickItem(tops, index);
    const bottom = pickItem(bottoms, index + 1);
    const shoe = shoes.length ? pickItem(shoes, index) : undefined;

    outfits.push({
      id: `outfit-combo-${index}`,
      name: preset.name,
      occasion: preset.occasion,
      rating: preset.rating,
      accent: preset.accent,
      layout: 'combo',
      items: {
        top,
        bottom,
        shoes: shoe,
      },
    });
  }

  for (let index = 0; index < otherCount; index += 1) {
    const presetIndex = (comboCount + index) % OUTFIT_PRESETS.length;
    const preset = OUTFIT_PRESETS[presetIndex];
    const other = pickItem(others, index);

    outfits.push({
      id: `outfit-standalone-${index}`,
      name: preset.name,
      occasion: preset.occasion,
      rating: preset.rating,
      accent: preset.accent,
      layout: 'standalone',
      items: {
        other,
      },
    });
  }

  return outfits;
};

export interface OutfitCarouselProps {
  onOutfitClick?: (outfit: OutfitSuggestion) => void;
}

export function OutfitCarousel({ onOutfitClick }: OutfitCarouselProps) {
  const items = useWardrobeStore((state) => state.items);

  const recentUploads = useMemo<RecentUpload[]>(() => {
    if (!items.length) {
      return mockRecentUploads;
    }

    const sorted = [...items].sort((a, b) => {
      const aTime = Date.parse(a.created_at ?? '') || 0;
      const bTime = Date.parse(b.created_at ?? '') || 0;
      return bTime - aTime;
    });

    const normalized = sorted
      .filter((item) => Boolean(item.image_url))
      .slice(0, 9)
      .map((item) => ({
        id: item.id,
        imageUrl: item.image_url,
        category: inferUploadCategory(item),
        color: item.color ?? 'neutral',
      }));

    return normalized.length ? normalized : mockRecentUploads;
  }, [items]);

  const outfits = useMemo(() => buildOutfits(recentUploads), [recentUploads]);

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/60 p-6 shadow-[0_30px_80px_-60px_rgba(15,23,42,0.65)] backdrop-blur-xl">
      <motion.div
        className="absolute -left-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-pink-200/70 via-purple-200/60 to-blue-200/70 blur-3xl"
        animate={{ x: [0, 18, 0], y: [0, -12, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-200/50 via-sky-200/50 to-emerald-200/50 blur-3xl"
        animate={{ x: [0, -12, 0], y: [0, 16, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-500/80">AI Curated</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 md:text-3xl">
              Combinations generated from your recent uploads
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs text-slate-500 shadow-sm md:flex">
            <span>Scroll</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>

        <div className="relative mt-6">
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-10 bg-gradient-to-r from-white/90 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-14 bg-gradient-to-l from-white/90 to-transparent" />

          <div className="flex gap-6 overflow-x-auto pb-6 pr-10 scroll-smooth snap-x snap-mandatory">
            {outfits.map((outfit) => (
              <motion.article
                key={outfit.id}
                variants={cardVariants}
                initial="rest"
                whileHover="hover"
                animate="rest"
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="group relative flex min-w-[260px] max-w-[320px] flex-1 snap-start flex-col rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.55)] backdrop-blur-xl"
                onClick={() => onOutfitClick?.(outfit)}
              >
                <motion.div
                  variants={imageVariants}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="relative aspect-[4/5] overflow-hidden rounded-2xl"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${outfit.accent}`} />
                  <div className="absolute -left-6 top-4 h-24 w-24 rounded-full bg-white/70 blur-2xl" />
                  <div className="absolute bottom-4 right-6 h-28 w-28 rounded-full bg-white/60 blur-2xl" />

                  <div className="relative z-10 h-full w-full p-4">
                    {outfit.layout === 'standalone' && outfit.items.other ? (
                      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/70 bg-white/40 shadow-lg">
                        <img
                          src={outfit.items.other.imageUrl}
                          alt={outfit.items.other.color}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="relative h-full w-full">
                        <div className="absolute left-0 top-2 w-[64%] overflow-hidden rounded-2xl border border-white/70 bg-white/40 shadow-lg">
                          <img
                            src={outfit.items.top?.imageUrl ?? ''}
                            alt={outfit.items.top?.color ?? ''}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute right-0 bottom-2 w-[64%] overflow-hidden rounded-2xl border border-white/70 bg-white/40 shadow-lg">
                          <img
                            src={outfit.items.bottom?.imageUrl ?? ''}
                            alt={outfit.items.bottom?.color ?? ''}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                        </div>
                        {outfit.items.shoes && (
                          <div className="absolute left-1/2 top-1/2 w-[46%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/70 bg-white/40 shadow-lg">
                            <img
                              src={outfit.items.shoes.imageUrl}
                              alt={outfit.items.shoes.color}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              loading="lazy"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/60 bg-white/75 p-3 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{outfit.name}</p>
                        <span className="mt-1 inline-flex items-center rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {outfit.occasion}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-xs font-semibold text-slate-700">
                        <Star className="h-3 w-3 text-amber-500" />
                        {outfit.rating}
                      </div>
                    </div>
                  </div>
                </motion.div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">AI Match</div>
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/70 bg-white/80 text-slate-700 shadow-sm transition hover:scale-105 hover:text-slate-900"
                    aria-label={`Open ${outfit.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOutfitClick?.(outfit);
                    }}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
