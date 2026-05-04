import type { VercelRequest, VercelResponse } from '@vercel/node';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || '';
const APIFY_ACTOR_ID = 'gUtzpgSANCUe5Gxdy';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { startUrls, maxResults = 50 } = req.body ?? {};

  if (!Array.isArray(startUrls) || startUrls.length === 0) {
    return res.status(400).json({ error: 'startUrls array is required' });
  }

  const normalizedStartUrls = startUrls
    .map((value: unknown) => {
      if (typeof value === 'string') {
        return value.trim();
      }
      if (value && typeof value === 'object' && 'url' in value) {
        return String((value as { url?: unknown }).url ?? '').trim();
      }
      return '';
    })
    .filter((value): value is string => Boolean(value));

  if (normalizedStartUrls.length === 0) {
    return res.status(400).json({ error: 'startUrls must contain at least one valid URL' });
  }

  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: 'APIFY_API_TOKEN not configured' });
  }

  try {
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}&waitForFinish=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: normalizedStartUrls,
          maxRequestRetries: 3,
          maxConcurrency: 4,
          maxResults: Number(maxResults),
        }),
      },
    );

    if (!runResponse.ok) {
      const text = await runResponse.text();
      return res.status(502).json({ error: 'Apify run failed', detail: text });
    }

    const run = await runResponse.json();
    const datasetId = run?.data?.defaultDatasetId;
    if (!datasetId) {
      return res.status(502).json({ error: 'No dataset returned from Apify run' });
    }

    const datasetResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&format=json`,
    );

    if (!datasetResponse.ok) {
      return res.status(502).json({ error: 'Failed to fetch dataset items' });
    }

    const items: unknown[] = await datasetResponse.json();

    const products = items.map((item: any) => {
      const currencySymbol = String(item.currencySymbol || '£').trim();
      const originalPrice = formatMoney(item.originalPrice, currencySymbol);
      const promotionalPrice = formatMoney(item.promotionalPrice, currencySymbol);
      const discount = String(item.discountPercent || '').trim();

      let price = 'N/A';
      if (promotionalPrice) {
        price = discount ? `${promotionalPrice} (${discount})` : promotionalPrice;
      } else if (originalPrice) {
        price = originalPrice;
      }

      return {
        name: String(item.name || 'N/A'),
        brand: String(item.brand || item.brandName || ''),
        price,
        image_url: String(item.imageUrl || item.image || ''),
        item_link: String(item.productUrl || item.url || ''),
      };
    });

    return res.status(200).json({ products });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal error', detail: err?.message });
  }
}

function formatMoney(value: unknown, symbol: string): string {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return `${symbol}${(num / 100).toFixed(2)}`;
}
