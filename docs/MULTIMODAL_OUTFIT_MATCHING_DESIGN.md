# Multimodal Outfit Matching Design

## Architecture

```mermaid
flowchart LR
  A[Wardrobe items + context] --> B[FashionItemEncoder]
  B --> C[OutfitCandidateRetriever]
  C --> D[Outfit candidate assembly]
  D --> E[NeuralOutfitScorer / OutfitCompatibilityRanker]
  E --> F[MMR diversity reranker]
  F --> G[/ai/recommend-outfits]
```

## Model I/O

- Garment embedding: `item_vector [512]`
- Context embedding: `context_vector [512]`
- Ranker input: `outfit_tokens [B, 6, 512]`
- Ranker mask: `attention_mask [B, 6]`
- Ranker output: `compatibility_logit [B, 1]`

Token order is `[CONTEXT, USER, TOP, BOTTOM, SHOES, ACCESSORY]`.
The transformer prepends `[CLS]` internally.

## Runtime Behavior

- `FashionItemEncoder` fuses image and metadata embeddings from a CLIP-like HF model.
- `OutfitCandidateRetriever` retrieves slot candidates by cosine similarity and MMR.
- `MultimodalOutfitRecommendationService` assembles outfits and reranks them.
- `NeuralOutfitScorer` uses a trained checkpoint when available.
- If no checkpoint exists, it falls back to zero-shot embedding geometry, not manual style/color weights.

## Hugging Face Encoder Options

- `patrickjohncyh/fashion-clip`
- `Marqo/marqo-fashionCLIP`

Configure with:

```bash
FASHION_ENCODER_MODEL_ID=patrickjohncyh/fashion-clip
FASHION_RANKER_CHECKPOINT=/data/fashion_ranker.pt
```

## Training

Use `hf_api/fashion_ai/training.py`.

Dataset format: JSONL rows with outfit slots, context, user profile, and label.

Negative sampling:

- Replace one slot with a same-category item.
- Prefer nearest-neighbor hard negatives in embedding space.

Loss:

- Binary cross entropy on outfit compatibility labels
- BPR pairwise ranking loss for positive > negative separation

## Database

Migration:

- `supabase/migrations/20260402000000_multimodal_outfit_embeddings.sql`

Adds:

- `garment_items.fashion_embedding vector(512)`
- `user_outfit_feedback`
- `user_style_profiles`

## API

`POST /ai/recommend-outfits`

Backward-compatible request:

```json
{
  "occasion": "formal",
  "top_selected": null,
  "bottom_selected": null,
  "wardrobe_items": []
}
```

Optional new fields:

```json
{
  "weather": { "season": "summer", "temperature_c": 32, "is_rainy": false },
  "region": "india",
  "user_profile": {
    "style_profile": "minimal",
    "favorite_colors": ["navy", "white"],
    "liked_item_ids": ["..."],
    "disliked_item_ids": ["..."]
  },
  "top_k": 5,
  "candidate_pool": 24,
  "diversity_lambda": 0.28
}
```
