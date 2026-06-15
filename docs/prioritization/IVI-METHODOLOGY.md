# Initiative Scoring: Mathematical Methodology

This document describes the complete mathematical model behind the initiative scoring framework. Anyone with this document can reimplement the calculation from scratch.

## Overview

initiative scores initiatives on a 0-100 scale by evaluating 35 dimensions grouped into 4 buckets. Each dimension is scored 0-6, with weights and optional inversion. Buckets use one of two aggregation methods. The final score is a weighted geometric mean of all bucket scores.

Weight profiles adapt the framework to different project contexts by overriding dimension weights. Dimensions with weight 0 are excluded from scoring and calculation.

## Scoring scale

Every dimension uses a 0-6 integer scale:

| Score | Meaning |
|-------|---------| 
| 0 | Worst possible / complete absence |
| 1 | Very low |
| 2 | Low |
| 3 | Moderate |
| 4 | Good |
| 5 | Very good |
| 6 | Best possible / ideal |

Each dimension has a rubric that defines what each score level means in context. See `scoring_framework.yaml` for the full rubric definitions.

## Inversion

Some dimensions are phrased so that a high raw score indicates a negative property (e.g., "bug risk" — a score of 6 means very high bug risk, which is bad). These dimensions have `inverted: true` in the framework definition.

For inverted dimensions:

```
adjusted = 6 - raw_score
```

For non-inverted dimensions:

```
adjusted = raw_score
```

This ensures that after adjustment, a higher value is always better.

## Normalization

Each adjusted score is normalized to the 0-1 range:

```
normalized = adjusted / 6
```

## Weight profiles

The framework defines 4 profiles that override dimension weights for different project contexts:

| Profile | Description | Active dims |
|---------|-------------|-------------|
| Enterprise | Large org with governance, compliance, multiple teams | 35 |
| Small team | Small team or startup with lightweight process | 35 |
| Solo dev | Solo developer or personal project | 29 |
| Open source | Open-source library with community consumers | 35 |

The Enterprise profile uses the base weights defined in each dimension. Other profiles override specific weights. Dimensions with weight 0 are excluded from scoring and calculation.

Bucket weights (1.3, 1.0, 1.0, 0.8) are constant across all profiles.

## Dimension weighting

Within each bucket, dimension weights are normalized so they sum to 1. Only dimensions with weight > 0 are included:

```
norm_weight_i = dimension_weight_i / sum(active dimension weights in the bucket)
```

## Bucket aggregation

### Weighted average (Value, Risk, Energy)

```
bucket_score = sum(norm_weight_i * normalized_i)
```

This produces a value between 0 and 1. The display score is `round(bucket_score * 100)`.

### Weighted geometric mean (Constraints)

```
L_i = normalized_i ^ norm_weight_i
bucket_score = product(L_i)
```

Since the normalized weights sum to 1, no additional exponent correction is needed.

**Critical property**: If any constraint dimension has `normalized = 0`, the entire bucket score becomes 0. This is by design — a fatal constraint (e.g., "legally prohibited") kills the initiative regardless of other scores.

## Total score

The total score is a weighted geometric mean across all 4 bucket scores:

```
total_bucket_weight = sum(all bucket weights)
norm_bucket_weight_j = bucket_weight_j / total_bucket_weight
P_j = bucket_score_j ^ norm_bucket_weight_j
total = product(P_j)
```

Since the normalized bucket weights sum to 1, this simplifies to a product of weighted powers.

The display total is `round(total * 100)`.

## Influence summaries

### Bucket influence by profile

Bucket weights are constant across all profiles, so each bucket's share of the total is the same regardless of profile. What changes is how influence is distributed among dimensions *within* each bucket.

| Bucket | Weight | Enterprise | Small team | Solo dev | Open source |
|--------|--------|------------|------------|----------|-------------|
| Value | 1.3 | 31.7% | 31.7% | 31.7% | 31.7% |
| Risk | 1.0 | 24.4% | 24.4% | 24.4% | 24.4% |
| Constraints | 1.0 | 24.4% | 24.4% | 24.4% | 24.4% |
| Energy | 0.8 | 19.5% | 19.5% | 19.5% | 19.5% |
| **Total** | **4.1** | **100%** | **100%** | **100%** | **100%** |

**Note on Constraints influence**: The percentages show the exponent weight used in the geometric mean. Unlike the other buckets where influence is linear and proportional, Constraints influence is nonlinear. Even a low-weight dimension can zero the entire bucket (and total) if it scores 0. A constraint dimension near 0 has outsized impact far beyond what its percentage suggests — this is the intended design for hard blockers.

### Topic influence by profile

Topics group dimensions by thematic concern across buckets. Unlike buckets, topic influence shifts across profiles because profiles change which dimensions are active and their relative weights.

| Topic | Enterprise | Small team | Solo dev | Open source |
|-------|------------|------------|----------|-------------|
| Strategy & Business | 32.2% | 31.0% | 30.6% | 29.9% |
| Delivery & Execution | 34.5% | 38.2% | 46.9% | 37.5% |
| Organization & People | 18.4% | 17.7% | 11.6% | 18.0% |
| Governance & Compliance | 14.9% | 13.1% | 10.9% | 14.6% |
| **Total** | **100%** | **100%** | **100%** | **100%** |

## Buckets and dimensions

### Value (bucket weight: 1.3, aggregation: weighted average)

| Dimension | Inv | Enterprise W | Enterprise % | Small team W | Small team % | Solo dev W | Solo dev % | Open source W | Open source % |
|-----------|:---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:|
| Strategic alignment |  | 3.1 | 10.0% | 3.1 | 10.0% | 3.0 | 10.0% | 3.1 | 9.7% |
| Business value |  | 3.1 | 10.0% | 3.1 | 10.0% | 3.0 | 10.0% | 3.1 | 9.7% |
| Opportunity enablement |  | 1.0 | 3.2% | 1.0 | 3.2% | 1.0 | 3.3% | 1.0 | 3.1% |
| Learning value |  | 0.7 | 2.3% | 0.7 | 2.3% | 0.7 | 2.3% | 0.7 | 2.2% |
| Sustainability / ESG impact |  | 0.6 | 1.9% | 0.2 | 0.6% | **0** | — | 0.2 | 0.6% |
| Run-cost footprint | Y | 0.9 | 2.9% | 0.9 | 2.9% | 0.9 | 3.0% | 0.9 | 2.8% |
| Developer experience impact |  | 0.4 | 1.3% | 0.8 | 2.6% | 0.9 | 3.0% | 1.1 | 3.5% |
| **Bucket total** | | **9.8** | **31.7%** | **9.8** | **31.7%** | **9.5** | **31.7%** | **10.1** | **31.7%** |

### Risk (bucket weight: 1.0, aggregation: weighted average)

| Dimension | Inv | Enterprise W | Enterprise % | Small team W | Small team % | Solo dev W | Solo dev % | Open source W | Open source % |
|-----------|:---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:|
| Risk reduction |  | 0.9 | 1.9% | 0.9 | 2.0% | 0.9 | 2.0% | 0.9 | 1.8% |
| Time criticality |  | 1.0 | 2.2% | 1.0 | 2.2% | 1.0 | 2.2% | 1.0 | 2.0% |
| Value decay over time | Y | 0.8 | 1.7% | 0.8 | 1.7% | 0.8 | 1.8% | 0.8 | 1.6% |
| Complexity / uncertainty | Y | 1.2 | 2.6% | 1.2 | 2.6% | 1.2 | 2.7% | 1.2 | 2.4% |
| Change-management blast radius | Y | 1.1 | 2.4% | 0.7 | 1.5% | 0.4 | 0.9% | 0.8 | 1.6% |
| Bug risk | Y | 0.8 | 1.7% | 0.8 | 1.7% | 0.8 | 1.8% | 0.8 | 1.6% |
| Problem framing clarity |  | 1.1 | 2.4% | 1.1 | 2.4% | 1.1 | 2.4% | 1.1 | 2.2% |
| Tolerance for imperfection | Y | 0.7 | 1.5% | 0.7 | 1.5% | 0.7 | 1.6% | 0.7 | 1.4% |
| Exploration likelihood | Y | 1.0 | 2.2% | 1.0 | 2.2% | 1.0 | 2.2% | 1.0 | 2.0% |
| Deep thinking need | Y | 0.6 | 1.3% | 0.6 | 1.3% | 0.6 | 1.3% | 0.6 | 1.2% |
| Code blast radius | Y | 0.6 | 1.3% | 0.9 | 2.0% | 1.1 | 2.4% | 1.2 | 2.4% |
| Reversibility | Y | 0.8 | 1.7% | 0.7 | 1.5% | 0.5 | 1.1% | 1.0 | 2.0% |
| Test confidence |  | 0.7 | 1.5% | 0.8 | 1.7% | 0.9 | 2.0% | 1.0 | 2.0% |
| **Bucket total** | | **11.3** | **24.4%** | **11.2** | **24.4%** | **11.0** | **24.4%** | **12.1** | **24.4%** |

### Constraints (bucket weight: 1.0, aggregation: weighted geometric mean)

| Dimension | Inv | Enterprise W | Enterprise % | Small team W | Small team % | Solo dev W | Solo dev % | Open source W | Open source % |
|-----------|:---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:|
| Capacity match |  | 1.2 | 3.6% | 1.2 | 4.2% | 1.2 | 5.0% | 1.2 | 3.7% |
| Dependency drag | Y | 1.0 | 3.0% | 1.0 | 3.5% | 1.0 | 4.2% | 1.0 | 3.0% |
| Bureaucratic lift / execution friction | Y | 0.9 | 2.7% | 0.4 | 1.4% | **0** | — | 0.5 | 1.5% |
| Legal / Policy feasibility |  | 1.3 | 3.9% | 1.3 | 4.6% | 1.3 | 5.5% | 1.3 | 4.0% |
| Data / Security clearance |  | 1.1 | 3.3% | 1.1 | 3.9% | 1.1 | 4.6% | 1.1 | 3.4% |
| External party consent |  | 0.9 | 2.7% | 0.5 | 1.8% | 0.2 | 0.8% | 0.6 | 1.8% |
| Sustainable maintainability | Y | 1.0 | 3.0% | 1.0 | 3.5% | 1.0 | 4.2% | 1.0 | 3.0% |
| Backward compatibility risk | Y | 0.8 | 2.4% | 0.4 | 1.4% | **0** | — | 1.3 | 4.0% |
| **Bucket total** | | **8.2** | **24.4%** | **6.9** | **24.4%** | **5.8** | **24.4%** | **8.0** | **24.4%** |

### Energy (bucket weight: 0.8, aggregation: weighted average)

| Dimension | Inv | Enterprise W | Enterprise % | Small team W | Small team % | Solo dev W | Solo dev % | Open source W | Open source % |
|-----------|:---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:|
| Job size | Y | 1.0 | 3.1% | 1.0 | 3.5% | 1.0 | 7.0% | 1.0 | 3.2% |
| Personal motivation |  | 0.8 | 2.5% | 0.8 | 2.8% | 0.8 | 5.6% | 0.8 | 2.6% |
| Organizational momentum |  | 1.6 | 5.0% | 1.4 | 5.0% | **0** | — | 0.8 | 2.6% |
| Stakeholder intensity |  | 1.0 | 3.1% | 0.6 | 2.1% | 0.2 | 1.4% | 0.9 | 2.9% |
| Cognitive fragmentation | Y | 0.8 | 2.5% | 0.8 | 2.8% | 0.8 | 5.6% | 0.8 | 2.6% |
| Narrative strength |  | 0.7 | 2.2% | 0.4 | 1.4% | **0** | — | 0.7 | 2.2% |
| Community demand |  | 0.3 | 0.9% | 0.5 | 1.8% | **0** | — | 1.1 | 3.5% |
| **Bucket total** | | **6.2** | **19.5%** | **5.5** | **19.5%** | **2.8** | **19.5%** | **6.1** | **19.5%** |

**Bold 0** entries indicate dimensions that are skipped entirely for that profile.

## Dimensions by topic

The 35 dimensions can also be viewed by cross-cutting topic rather than by bucket. Each topic groups dimensions that share a thematic concern, regardless of which bucket they belong to. Tables are ordered by topic influence (descending), and dimensions within each table are ordered by their influence on the total score (enterprise profile).

### Strategy & Business

Dimensions that evaluate the initiative's alignment with organizational strategy, market positioning, and financial impact.

| | Enterprise | Small team | Solo dev | Open source |
|---|------------|------------|----------|-------------|
| **Topic total** | **32.2%** | **31.0%** | **30.6%** | **29.9%** |

| Bucket | Dimension | Description | Enterprise | Small team | Solo dev | Open source |
|--------|-----------|-------------|------------|------------|----------|-------------|
| Value | Business value | How substantial is the revenue increase, cost savings, strategic leverage, custome... | 10.0% | 10.0% | 10.0% | 9.7% |
| Value | Strategic alignment | Does this advance our strategic objectives? | 10.0% | 10.0% | 10.0% | 9.7% |
| Value | Opportunity enablement | If we do this initiative, to what extent do we enable other initiatives or keep ma... | 3.2% | 3.2% | 3.3% | 3.1% |
| Value | Run-cost footprint | Will it raise cloud/ops costs post-launch? | 2.9% | 2.9% | 3.0% | 2.8% |
| Risk | Time criticality | How urgent is it to complete this initiative, e.g. due to deadlines, seasons, comp... | 2.2% | 2.2% | 2.2% | 2.0% |
| Risk | Risk reduction | If we do this initiative, to what extent do we reduce risk in a certain area? | 1.9% | 2.0% | 2.0% | 1.8% |
| Value | Sustainability / ESG impact | Does it move carbon, diversity, or ethical needles? | 1.9% | 0.6% | — | 0.6% |

### Delivery & Execution

Dimensions that assess technical difficulty, solution clarity, development risk, and the practical effort needed to deliver.

| | Enterprise | Small team | Solo dev | Open source |
|---|------------|------------|----------|-------------|
| **Topic total** | **34.5%** | **38.2%** | **46.9%** | **37.5%** |

| Bucket | Dimension | Description | Enterprise | Small team | Solo dev | Open source |
|--------|-----------|-------------|------------|------------|----------|-------------|
| Constraints | Capacity match | Do we actually have the available team capacity (skills, people, tools) to execute... | 3.6% | 4.2% | 5.0% | 3.7% |
| Energy | Job size | If achieved perfectly and without delays, how much time would it take to finish th... | 3.1% | 3.5% | 7.0% | 3.2% |
| Constraints | Dependency drag | Are we gated by other teams or vendors? | 3.0% | 3.5% | 4.2% | 3.0% |
| Constraints | Sustainable maintainability | Will this initiative require ongoing manual work, handoffs, coordination, or other... | 3.0% | 3.5% | 4.2% | 3.0% |
| Risk | Complexity / uncertainty | How vague/ambiguous are the requirements or solution? | 2.6% | 2.6% | 2.7% | 2.4% |
| Energy | Cognitive fragmentation | Will this initiative be hard to stay focused on due to task-switching, external in... | 2.5% | 2.8% | 5.6% | 2.6% |
| Risk | Problem framing clarity | How precise are the descriptions and understanding of what we are building? | 2.4% | 2.4% | 2.4% | 2.2% |
| Risk | Change-management blast radius | How much organizational/process upheaval will this create? | 2.4% | 1.5% | 0.9% | 1.6% |
| Value | Learning value | Will the team gain reusable skills or assets? | 2.3% | 2.3% | 2.3% | 2.2% |
| Risk | Exploration likelihood | How likely is it we need to iterate or pivot to find a good solution? | 2.2% | 2.2% | 2.2% | 2.0% |
| Risk | Reversibility | If this goes wrong, how easy is it to roll back? | 1.7% | 1.5% | 1.1% | 2.0% |
| Risk | Bug risk | How likely is this initiative to introduce bugs during development? | 1.7% | 1.7% | 1.8% | 1.6% |
| Risk | Test confidence | How well can we verify this works before shipping? | 1.5% | 1.7% | 2.0% | 2.0% |
| Risk | Code blast radius | How many modules, APIs, or downstream consumers will this change touch or break? | 1.3% | 2.0% | 2.4% | 2.4% |
| Value | Developer experience impact | Does this make the codebase better or worse to work with — readability, ergonomics... | 1.3% | 2.6% | 3.0% | 3.5% |

### Organization & People

Dimensions that measure human factors: motivation, momentum, stakeholder pressure, focus conditions, and communication.

| | Enterprise | Small team | Solo dev | Open source |
|---|------------|------------|----------|-------------|
| **Topic total** | **18.4%** | **17.7%** | **11.6%** | **18.0%** |

| Bucket | Dimension | Description | Enterprise | Small team | Solo dev | Open source |
|--------|-----------|-------------|------------|------------|----------|-------------|
| Energy | Organizational momentum | Is the organization already mobilized around this theme? | 5.0% | 5.0% | — | 2.6% |
| Energy | Stakeholder intensity | How passionately do exec sponsors, customers, or regulators want this? | 3.1% | 2.1% | 1.4% | 2.9% |
| Energy | Personal motivation | How motivated is the involved staff to work on this? | 2.5% | 2.8% | 5.6% | 2.6% |
| Energy | Narrative strength | Can this initiative be clearly articulated and emotionally compelling to stakehold... | 2.2% | 1.4% | — | 2.2% |
| Risk | Value decay over time | What is the likelihood this will not be valuable in 10 years? | 1.7% | 1.7% | 1.8% | 1.6% |
| Risk | Tolerance for imperfection | How important is it that this initiative works perfectly? | 1.5% | 1.5% | 1.6% | 1.4% |
| Risk | Deep thinking need | How big is the cognitive start-up cost when resuming this work? | 1.3% | 1.3% | 1.3% | 1.2% |
| Energy | Community demand | How strongly are users, contributors, or the community requesting this? | 0.9% | 1.8% | — | 3.5% |

### Governance & Compliance

Dimensions that evaluate legal, regulatory, security, and approval barriers — hard blockers that can kill an initiative regardless of its value.

| | Enterprise | Small team | Solo dev | Open source |
|---|------------|------------|----------|-------------|
| **Topic total** | **14.9%** | **13.1%** | **10.9%** | **14.6%** |

| Bucket | Dimension | Description | Enterprise | Small team | Solo dev | Open source |
|--------|-----------|-------------|------------|------------|----------|-------------|
| Constraints | Legal / Policy feasibility | Is there anything in law, regulation, or policy that flat-out forbids this? | 3.9% | 4.6% | 5.5% | 4.0% |
| Constraints | Data / Security clearance | Is access to the necessary data, environments, or authorizations possible? | 3.3% | 3.9% | 4.6% | 3.4% |
| Constraints | Bureaucratic lift / execution friction | How hard will it be to get this through governance, legal, leadership, or partner ... | 2.7% | 1.4% | — | 1.5% |
| Constraints | External party consent | Do we have the necessary consent from external parties? | 2.7% | 1.8% | 0.8% | 1.8% |
| Constraints | Backward compatibility risk | Will this break existing consumers, APIs, or contracts? | 2.4% | 1.4% | — | 4.0% |

**Note**: Some dimensions appear in multiple topics when they serve dual purposes. The influence percentages are the same — they are not double-counted in the total score.
