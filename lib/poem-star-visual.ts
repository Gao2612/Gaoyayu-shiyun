import { Color } from "three";

import type { Poem, PoemPosition } from "@/types/poem";

export type PoemStarVisual = Readonly<{
  id: string;
  position: PoemPosition;
  scale: number;
  color: Color;
}>;

const GALAXY_SEED: number = 0x5f3759df;
const STAR_PALETTE: readonly string[] = [
  "#8ecae6",
  "#b9add8",
  "#f3cf9a",
  "#8fd6c8",
  "#efb5c4",
];

function hashText(value: string): number {
  let hash: number = GALAXY_SEED;

  for (let index: number = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state: number = seed >>> 0;

  return (): number => {
    state += 0x6d2b79f5;
    let value: number = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createStablePosition(poemId: string): PoemPosition {
  const random: () => number = createSeededRandom(hashText(poemId));
  const angle: number = random() * Math.PI * 2;
  const radius: number = 2.2 + random() * 3.4;
  const height: number = (random() - 0.5) * 4.4;
  const depthScale: number = 0.58 + random() * 0.3;

  return [
    Math.cos(angle) * radius,
    height,
    Math.sin(angle) * radius * depthScale,
  ];
}

function createStarColor(poem: Poem): Color {
  const paletteIndex: number =
    hashText(poem.collection) % STAR_PALETTE.length;
  const brightness: number = poem.featured
    ? 1.55
    : 0.82 + poem.rating * 0.1;

  return new Color(STAR_PALETTE[paletteIndex]).multiplyScalar(brightness);
}

function createStarScale(poem: Poem): number {
  const ratingScale: number = 0.075 + poem.rating * 0.018;
  return poem.featured ? ratingScale * 1.24 : ratingScale;
}

export function createPoemStarVisual(
  poem: Poem,
): PoemStarVisual {
  return {
    id: poem.id,
    position: createStablePosition(poem.id),
    scale: createStarScale(poem),
    color: createStarColor(poem),
  };
}

export function createPoemStarVisuals(
  poems: readonly Poem[],
): readonly PoemStarVisual[] {
  return poems.map(createPoemStarVisual);
}
