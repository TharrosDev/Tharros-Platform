# RAG Eval Results

Corpus: 5 fixtures · 20 questions (4 negatives).
Embeddings: text-embedding-3-small. Answers: claude-opus-4-8. Judge: claude-haiku-4-5.

## Retrieval sweep (chunk × top-k)

| chunk   | k   | recall | precision | MRR  |
| ------- | --- | ------ | --------- | ---- |
| 300/60  | 4   | 100%   | 25%       | 1.00 |
| 300/60  | 6   | 100%   | 20%       | 1.00 |
| 300/60  | 8   | 100%   | 20%       | 1.00 |
| 500/80  | 4   | 100%   | 25%       | 1.00 |
| 500/80  | 6   | 100%   | 20%       | 1.00 |
| 500/80  | 8   | 100%   | 20%       | 1.00 |
| 800/120 | 4   | 100%   | 25%       | 1.00 |
| 800/120 | 6   | 100%   | 20%       | 1.00 |
| 800/120 | 8   | 100%   | 20%       | 1.00 |

**Retrieval winner:** chunk 300/60, k=4 (recall 100%, MRR 1.00). Baseline 500/80/k4: recall 100%, MRR 1.00.

## Answer quality (baseline + winner)

| config   | chunk  | k   | citation acc | cite jaccard | cite coverage | fact-hit | faithfulness | negatives handled |
| -------- | ------ | --- | ------------ | ------------ | ------------- | -------- | ------------ | ----------------- |
| baseline | 500/80 | 4   | 100%         | 1.00         | 100%          | 100%     | 0.97         | 75%               |
| winner   | 300/60 | 4   | 100%         | 1.00         | 100%          | 100%     | 0.94         | 100%              |

## Baseline per-question citations

- **refund-window** (refund-policy.md) → cited [refund-policy.md]
- **refund-restocking** (refund-policy.md) → cited [refund-policy.md]
- **refund-damaged** (refund-policy.md) → cited [refund-policy.md]
- **hours-saturday** (hours-and-contact.md) → cited [hours-and-contact.md]
- **hours-phone** (hours-and-contact.md) → cited [hours-and-contact.md]
- **hours-sunday** (hours-and-contact.md) → cited [hours-and-contact.md]
- **ship-free-threshold** (shipping-policy.md) → cited [shipping-policy.md]
- **ship-express-cost** (shipping-policy.md) → cited [shipping-policy.md]
- **ship-cutoff** (shipping-policy.md) → cited [shipping-policy.md]
- **price-plus-tier** (pricing.md) → cited [pricing.md]
- **price-premier** (pricing.md) → cited [pricing.md]
- **price-match-window** (pricing.md) → cited [pricing.md]
- **hb-vacation** (employee-handbook.md) → cited [employee-handbook.md]
- **hb-remote** (employee-handbook.md) → cited [employee-handbook.md]
- **hb-probation** (employee-handbook.md) → cited [employee-handbook.md]
- **hb-sick** (employee-handbook.md) → cited [employee-handbook.md]
- **neg-warranty** (neg) → cited []
- **neg-ceo** (neg) → cited []
- **neg-parking** (neg) → cited []
- **neg-loyalty-points** (neg) → cited [pricing.md]
