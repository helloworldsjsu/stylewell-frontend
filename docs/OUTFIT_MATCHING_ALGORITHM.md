# Outfit Matching Algorithm (Intelligent v1)

## Purpose
This document explains the current outfit matching system implemented in the backend (`api.py`) for:
- `POST /ai/score-outfit`
- `POST /ai/recommend-outfits`

The algorithm is designed to be:
- Explainable: returns reason, evidence, penalties, and improvements.
- Backward-compatible: keeps legacy fields (`score`, `breakdown`, `reason`, `tip`).
- Extensible: supports optional user personalization via `user_profile`.

---

## High-Level Flow

### 1. Input validation and routing
All matching operations are routed through:
- `run_wardrobe_model_task(task, payload, occasion)`

Tasks:
- `outfit_scoring`: score one top + one bottom.
- `outfit_recommendation`: generate ranked outfit pairs for cases A/B/C/D.

### 2. Pair scoring engine
Each candidate pair is evaluated by `_score_pair(top, bottom, occasion, user_profile=None)`.

The engine computes:
- Primary dimensions (legacy and new)
- Penalties and occasion violations
- Confidence score
- Explainability metadata
- Improvement suggestions
- Diversity signature

### 3. Ranking and diversity control
For recommendation mode:
- Generate candidate pairs by case logic.
- Score all pairs.
- Sort by `score` descending.
- Apply diversity-aware reranking to reduce repetitive looks.

### 4. Response shaping
The API returns legacy keys plus additive intelligent fields.
`engine_version` is set to `intelligent-v1`.

---

## Case Handling Logic

The recommendation endpoint supports 4 cases:

- Case A: No top selected and no bottom selected
  - Pair all tops with all bottoms.

- Case B: Top selected, bottom not selected
  - Pair selected top with all bottoms.

- Case C: Bottom selected, top not selected
  - Pair selected bottom with all tops.

- Case D: Both top and bottom selected
  - Score the selected pair.
  - Also return `improved_recommendations` from better alternatives.

---

## Intelligent Scoring Dimensions

### Legacy breakdown dimensions (kept)
- `color` (0-25 scale behavior)
- `style` (0-25 scale behavior)
- `occasion` (0-20)
- `pattern` (0-15)
- `season` (0-15)

These are still returned in `breakdown` for frontend compatibility.

### Additional dimensions (new)
- `fabric` (texture/material compatibility)
- `fit` (silhouette/fit balance)
- `personalization_fit` (optional user preference alignment)

These are returned in `dimensions`.

---

## Core Scoring Formula

The algorithm computes a weighted base total and then applies penalties.

Base weighted total:

`total_base = color + style + occasion + pattern + season + round(0.6*fabric) + round(0.4*fit) + round(0.5*personalization_fit)`

Then penalty adjustment:

`total = clamp(0, 100, total_base + sum(penalty_impact))`

Where:
- Pattern/fabric structural penalties are included.
- Occasion violations add a hard penalty (`occasion_violation`, impact `-20`).

Compatibility labels:
- `high` if `score >= 70`
- `medium` if `45 <= score < 70`
- `low` if `score < 45`

---

## Dimension Details

### 1) Color harmony
Color tokens and families are extracted from item color text.
The score rewards:
- Shared tones
- Neutral pairings
- Complementary family pairings

It penalizes weak family alignment.

### 2) Style alignment
Maps styles into groups (formal/casual/party/ethnic/sport) and scores:
- Same group highest
- Occasion-aligned mixed groups moderate
- Mismatch lower

### 3) Occasion fit
Uses occasion-category priors (`OCCASION_CATEGORY_SCORE`) and averages top + bottom fit.

### 4) Pattern balance
Uses pattern complexity levels and penalizes pattern overload.
Typical behavior:
- Solid + solid: high
- Solid + pattern: good
- Busy + busy: lower, possible penalty

### 5) Season fit
Rewards same season or all-season combinations.

### 6) Fabric fit
Compares fabric compatibility and adds penalties for strong texture conflicts.

### 7) Fit balance
Scores silhouette coherence based on fit tags.

### 8) Personalization fit (optional)
Reads optional `user_profile` and scores alignment with:
- preferred colors
- preferred patterns
- preferred occasions

If no profile is provided, this dimension stays neutral.

---

## Confidence Model

Confidence is computed using:
- Dimension variance
- Total penalty impact
- Number of occasion violations
- Missing signal count (`unknown`/empty fields)

Output range is clipped to:
- minimum `0.20`
- maximum `0.95`

This allows UI to distinguish high-certainty vs low-certainty recommendations.

---

## Explainability Outputs

Each scored pair can include:
- `evidence`: short natural-language support statements
- `penalties`: list of penalty objects
  - `id`
  - `impact`
  - `explanation`
- `improvements`: targeted actions with expected gain
  - `id`
  - `priority`
  - `expected_gain`
  - `action`

This enables an actionable and transparent recommendation UX.

---

## Diversity-Aware Reranking

After score sorting, the system builds a `diversity_signature` per pair:
- top color family
- bottom color family
- top pattern token
- bottom pattern token
- style group

Reranking behavior:
- Prefer unique signatures first
- Fill remaining slots from top score list

Goal:
- Reduce repetitive top-5 suggestions
- Preserve quality while improving variety

---

## Endpoint Contracts

## `POST /ai/score-outfit`

### Request (example)
```json
{
  "top": {"category": "Shirt", "color": "White", "pattern": "Solid", "style": "formal"},
  "bottom": {"category": "Trousers", "color": "Navy", "pattern": "Solid", "style": "formal"},
  "occasion": "interview",
  "user_profile": {
    "preferred_colors": ["white", "navy"],
    "preferred_patterns": ["solid"],
    "preferred_occasions": ["interview", "formal"]
  }
}
```

### Response (shape)
- Backward-compatible:
  - `score`, `color_score`, `style_score`, `occasion_score`, `reason`, `tip`
- New additive fields:
  - `confidence`, `dimensions`, `penalties`, `evidence`, `improvements`
  - `engine_version: "intelligent-v1"`

---

## `POST /ai/recommend-outfits`

### Request (example)
```json
{
  "occasion": "formal",
  "top_selected": null,
  "bottom_selected": null,
  "wardrobe_items": [
    {"id": "1", "type": "topwear", "category": "Shirt", "color": "White", "pattern": "Solid", "style": "formal"},
    {"id": "2", "type": "bottomwear", "category": "Trousers", "color": "Navy", "pattern": "Solid", "style": "formal"}
  ],
  "user_profile": {
    "preferred_colors": ["navy", "white"],
    "preferred_patterns": ["solid"],
    "preferred_occasions": ["formal"]
  }
}
```

### Response (shape)
- Existing fields retained:
  - `occasion`, `case`, `selected_outfit_score`, `recommendations`, `total_combinations_checked`, `notice`
- New additive fields:
  - `recommendations[*].confidence`
  - `recommendations[*].dimensions`
  - `recommendations[*].penalties`
  - `recommendations[*].evidence`
  - `recommendations[*].improvements`
  - `improved_recommendations` (especially for case D)
  - `engine_version: "intelligent-v1"`

---

## Backward Compatibility Guarantees

The integration was done to avoid disruption:
- No endpoint name changes
- No required request field changes
- Existing core response keys preserved
- New fields are additive and optional for clients to consume

Older frontend code can ignore new keys and continue working.

---

## Data Quality Expectations

For best scoring quality, wardrobe items should include:
- `type` (`topwear`/`bottomwear`)
- `category`
- `color`
- `pattern`
- `style`
- `season`
- `fabric`
- `fit`

If fields are missing or `Unknown`, scoring still works but confidence is reduced.

---

## Known Limitations

- The model is deterministic/rule-augmented, not yet learned from long-term user feedback events.
- Personalization is profile-based, not behavior-trained.
- Does not yet consider footwear/accessory completion as separate optimization dimensions.

---

## Recommended Next Enhancements

1. Persist user feedback events (`accepted`, `rejected`, `worn`) and train preference weights.
2. Add weather/context input (temperature, location, indoor/outdoor).
3. Add wardrobe rotation/frequency penalty (avoid repeating recently worn pairings).
4. Add calibration layer to map score to expected acceptance probability.
5. Add A/B switch for engine versions (`intelligent-v1`, `intelligent-v2`) for controlled rollout.

---

## Quick Troubleshooting

If recommendations look too generic:
- Ensure garment metadata has real `style`, `fabric`, `fit`, and `season` values.
- Pass `user_profile` in request payload.
- Check for too many `Unknown` values lowering confidence.

If repeated looks appear:
- Verify `diversity_signature` is present for each candidate.
- Confirm candidate pool has enough valid top-bottom combinations.

If score seems high with violations:
- Inspect `penalties` and `occasion_violations` in response.
- Ensure violation rules include your required strictness for target occasions.
