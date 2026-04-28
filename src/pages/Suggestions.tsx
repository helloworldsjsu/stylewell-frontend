import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Search, Sparkles } from 'lucide-react';
import { getGemmaScraperRecommendations, getWardrobeItems } from '../api/client';
import { inferWardrobeSlot } from '../lib/wardrobeSlots';

interface RawWardrobeItem {
  id: string;
  image_url: string;
  description?: string | { category?: string; type?: string } | null;
}

interface ScraperProductView {
  item_link: string;
  name: string;
  price: string;
  image_url: string;
  brand?: string;
}

const EXAMPLE_PROMPTS = [
  'Need a formal office shirt in navy or charcoal with a structured fit and minimal styling. Avoid oversized cuts.',
  'Looking for casual daily trousers in beige, olive, or black with a comfortable straight fit. Avoid ripped or distressed styles.',
  'Need a party jacket for evening outings in black or charcoal with a smart polished look. Avoid hoodies.',
  'Looking for gym shorts in black, grey, or navy with a lightweight breathable feel. Avoid loud prints.',
  'Need a casual weekend polo in white, beige, or olive with a clean minimal style. Avoid athleisure-heavy designs.',
];

export function Suggestions() {
  const [requestText, setRequestText] = useState('');
  const [selectedStore, setSelectedStore] = useState<'default' | 'nike' | 'zalando'>('default');
  const [selectedGender, setSelectedGender] = useState<'men' | 'women' | 'unisex'>('men');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scraperUrls, setScraperUrls] = useState<string[]>([]);
  const [scraperProducts, setScraperProducts] = useState<ScraperProductView[]>([]);
  const [wardrobeCount, setWardrobeCount] = useState({ total: 0, tops: 0, bottoms: 0, others: 0 });

  useEffect(() => {
    const loadWardrobe = async () => {
      try {
        const data = await getWardrobeItems();
        const items: RawWardrobeItem[] = data.items ?? [];
        const counts = items.reduce(
          (acc: { total: number; tops: number; bottoms: number; others: number }, item) => {
            const description = typeof item.description === 'string' ? JSON.parse(item.description) : item.description ?? {};
            const itemType = inferWardrobeSlot(description?.type, description?.category);
            acc.total += 1;
            if (itemType === 'topwear') acc.tops += 1;
            if (itemType === 'bottomwear') acc.bottoms += 1;
            if (itemType === 'others') acc.others += 1;
            return acc;
          },
          { total: 0, tops: 0, bottoms: 0, others: 0 },
        );

        setWardrobeCount(counts);
      } catch (loadError) {
        console.error('Failed to load wardrobe counts:', loadError);
      }
    };

    loadWardrobe();
  }, []);

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = requestText.trim();
    if (!prompt) {
      setError('Please describe what you want in natural language.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setNotice(null);
      setScraperUrls([]);
      setScraperProducts([]);

      const response = await getGemmaScraperRecommendations({
        userPrompt: prompt,
        occasion: 'auto',
        gender: selectedGender,
        store: selectedStore === 'default' ? undefined : selectedStore,
      });

      setScraperUrls(Array.isArray(response.search_urls) ? response.search_urls : []);
      setScraperProducts(Array.isArray(response.products) ? (response.products as ScraperProductView[]) : []);

      if (!Array.isArray(response.search_urls) || response.search_urls.length === 0) {
        setNotice('Model generated a plan, but no search URLs were returned for this request.');
      } else if (!Array.isArray(response.products) || response.products.length === 0) {
        setNotice('Search URLs were generated, but scraping did not return products for this request.');
      }
    } catch (requestError: unknown) {
      const message = requestError instanceof Error ? requestError.message : 'Failed to generate search URLs';
      setError(message);
      setScraperUrls([]);
      setScraperProducts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Shopping Suggestions</h1>
        <p className="text-sm text-slate-600">Describe your requirement naturally. The model will use wardrobe context, occasion, fit preferences, and the store you select.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleGenerate} className="space-y-5">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 text-amber-500" />
              <div className="space-y-1">
                <p>Wardrobe loaded: {wardrobeCount.total} items, {wardrobeCount.tops} tops, {wardrobeCount.bottoms} bottoms, {wardrobeCount.others} others.</p>
                <p>Results will follow the selected store and the backend model.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[7fr_3fr]">
            <div>
              <label htmlFor="request-text" className="mb-2 block text-sm font-medium text-slate-700">
                What are you looking for?
              </label>
              <textarea
                id="request-text"
                value={requestText}
                onChange={(event) => setRequestText(event.target.value)}
                placeholder="Example: Need a formal office shirt in navy or charcoal with a structured fit. Avoid oversized or loud prints."
                className="min-h-[132px] w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <p className="mt-2 text-xs text-slate-500">For best results, mention one clear item type like shirt, jacket, trousers, joggers, or shorts, plus occasion, colors, fit, and any avoid constraints.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="store-select" className="mb-2 block text-sm font-medium text-slate-700">
                  Store
                </label>
                <select
                  id="store-select"
                  value={selectedStore}
                  onChange={(event) => setSelectedStore(event.target.value as 'default' | 'nike' | 'zalando')}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="default">Default</option>
                  <option value="nike">Nike</option>
                  <option value="zalando">Zalando</option>
                </select>
              </div>

              <div>
                <label htmlFor="gender-select" className="mb-2 block text-sm font-medium text-slate-700">
                  Gender
                </label>
                <select
                  id="gender-select"
                  value={selectedGender}
                  onChange={(event) => setSelectedGender(event.target.value as 'men' | 'women' | 'unisex')}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                  <option value="unisex">Unisex</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Example Prompts</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setRequestText(example)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-slate-400"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Generate Product Feed
          </button>
        </form>
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
      {notice && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{notice}</div>}

      {loading && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-14">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-slate-700" />
          <p className="text-sm text-slate-600">The model is extracting intent and generating a store for you...</p>
        </div>
      )}

      {!loading && scraperProducts.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Scraped Products</h2>
            <p className="text-sm text-slate-600">Products scraped directly from the generated search URLs.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {scraperProducts.map((product, index) => (
              <article key={`${product.item_link}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                <div className="aspect-square w-full overflow-hidden bg-white">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="space-y-2 p-4">
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900">{product.name}</p>
                  <p className="text-xs text-slate-600">{product.brand || 'Brand unavailable'}</p>
                  <p className="text-sm font-medium text-emerald-700">{product.price}</p>
                  <a
                    href={product.item_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"
                  >
                    View Product
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && scraperUrls.length === 0 && scraperProducts.length === 0 && !error && !notice && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Search className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <p className="text-slate-600">Describe a specific item type, occasion, colors, fit, and avoid constraints to generate better store search URLs.</p>
        </div>
      )}
    </div>
  );
}
