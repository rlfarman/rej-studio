/** What a single AAV capsid packages, end to end. */
export const AAV_PACKAGING_LIMIT = 4700

/**
 * Typical AAV construct overhead:
 * ITRs ~290 bp + Promoter ~800 bp + polyA ~250 bp + regulatory ~200 bp = ~1540 bp
 *
 * A *typical* cassette, not a constant of nature — a lab using a short
 * promoter gets more room for coding sequence. It is the one number to
 * change: the AAV fit tiers, the length chart's reference lines and the
 * design tool's fit summary are all derived from it.
 */
export const AAV_OVERHEAD_BP = 1540

/**
 * Coding sequence one vector can carry: the capsid's capacity less the
 * cassette around the insert. In REJ every fragment is packaged in its own
 * complete cassette, so each fragment pays the overhead — n vectors carry
 * n × this, not the capsid limit split n ways.
 */
export const AAV_CDS_CAPACITY_BP = AAV_PACKAGING_LIMIT - AAV_OVERHEAD_BP

/**
 * The CDS lengths the AAV fit tiers turn over at: up to one vector's worth is
 * single, up to two is dual, beyond that triple.
 */
export const AAV_CDS_TIER_LIMITS = {
  single: AAV_CDS_CAPACITY_BP,
  dual: AAV_CDS_CAPACITY_BP * 2,
} as const
