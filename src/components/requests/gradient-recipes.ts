import type { CSSProperties } from "react"

/**
 * Cover gradients for the request cards. The design system is monochrome by
 * intent — near-black text, neutral chrome, no shadows — so the card cover
 * is where a little colour is allowed to live: one image-like gradient per
 * request, while title and metadata stay plain.
 *
 * Recipes are curated rather than generated from a raw hue: the first pass
 * (seeded hue wheels) drifted into muddy reds and washed-out teals. Each
 * recipe below is a hand-picked two/three-stop diagonal that reads clean on
 * a white card, plus a soft highlight bloom in the top corner for depth.
 */

type Recipe = {
  /** Hand-tuned diagonal stops. */
  stops: [string, string, string]
  /** Highlight bloom hue, layered softly over the diagonal. */
  bloomHue: number
}

const RECIPES: Recipe[] = [
  // Violet → orchid
  {
    stops: ["hsl(258 92% 63%)", "hsl(285 82% 60%)", "hsl(318 78% 62%)"],
    bloomHue: 268,
  },
  // Azure → indigo
  {
    stops: ["hsl(198 90% 58%)", "hsl(221 88% 60%)", "hsl(258 85% 62%)"],
    bloomHue: 210,
  },
  // Emerald → sky
  {
    stops: ["hsl(160 85% 45%)", "hsl(182 82% 48%)", "hsl(196 85% 55%)"],
    bloomHue: 170,
  },
  // Coral → rose gold
  {
    stops: ["hsl(336 84% 60%)", "hsl(356 88% 62%)", "hsl(22 95% 64%)"],
    bloomHue: 348,
  },
  // Amber → sunset
  {
    stops: ["hsl(38 96% 58%)", "hsl(22 92% 60%)", "hsl(348 84% 62%)"],
    bloomHue: 30,
  },
  // Deep ocean
  {
    stops: ["hsl(242 78% 58%)", "hsl(224 82% 55%)", "hsl(214 85% 50%)"],
    bloomHue: 232,
  },
]

/** Small, stable FNV-1a so covers stay deterministic without React state. */
export function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const GRADIENT_RECIPE_COUNT = RECIPES.length

/** Pick one of the curated recipes from (any part of) a request's identity. */
export function gradientRecipeIndex(seed: string): number {
  return hashString(seed) % RECIPES.length
}

/**
 * The cover artwork for a card: a vivid diagonal with a quiet bloom where
 * the eye lands first. Same request → same file, every render.
 */
export function coverGradientStyle(seed: string): CSSProperties {
  const recipe = RECIPES[gradientRecipeIndex(seed) % RECIPES.length]!
  return {
    backgroundImage: [
      `radial-gradient(120% 130% at 12% 0%, hsl(${recipe.bloomHue} 95% 78% / 0.65) 0%, transparent 48%)`,
      `linear-gradient(140deg, ${recipe.stops[0]} 0%, ${recipe.stops[1]} 55%, ${recipe.stops[2]} 100%)`,
    ].join(", "),
  }
}
