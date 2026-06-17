import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { UMAP } from "umap-js";
import { z } from "zod";

const LAYOUT_SCHEMA_VERSION: number = 1;
const LAYOUT_VERSION: string = "semantic-umap-3d-v1";
const LAYOUT_SEED: number = 0x6a09e667;
const OUTPUT_FILE_NAME: string = "poem-layout.json";
const TARGET_RADIUS: number = 5.6;
const MIN_DISTANCE: number = 0.54;
const OVERLAP_ITERATIONS: number = 18;
const THEME_OFFSET_STRENGTH: number = 0.28;
const TIME_OFFSET_STRENGTH: number = 0.42;
const POSITION_PRECISION: number = 4;

const poemPositionSchema = z.tuple([z.number(), z.number(), z.number()]);

const poemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  writtenAt: z.string().min(1),
  tags: z.array(z.string()),
  location: z.string().nullable(),
  collection: z.string().min(1),
  emotions: z.array(z.string()),
  classicalForms: z.array(z.string()),
  ciTune: z.string().nullable(),
  quTune: z.string().nullable(),
  featured: z.boolean(),
  rating: z.number(),
  position: poemPositionSchema.nullable(),
  relatedPoemIds: z.array(z.string()),
});

const vectorEntrySchema = z.object({
  poemId: z.string().min(1),
  title: z.string().min(1),
  modelVersion: z.string().min(1),
  inputHash: z.string().min(1),
  vector: z.array(z.number()),
});

const vectorCacheSchema = z.object({
  model: z.object({
    version: z.string().min(1),
    dimensions: z.number().int().min(1),
  }),
  vectors: z.array(vectorEntrySchema),
});

const poemsSchema = z.array(poemSchema);

type Poem = z.infer<typeof poemSchema>;
type VectorEntry = z.infer<typeof vectorEntrySchema>;
type VectorCache = z.infer<typeof vectorCacheSchema>;
type Position3D = [number, number, number];

type LayoutEntry = Readonly<{
  poemId: string;
  title: string;
  collection: string;
  year: string;
  position: Position3D;
}>;

type LayoutOutput = Readonly<{
  schemaVersion: number;
  layoutVersion: string;
  generatedAt: string;
  sourceVectorModelVersion: string;
  sourceVectorDimensions: number;
  umap: Readonly<{
    dimensions: number;
    neighbors: number;
    epochs: number;
    minDist: number;
    spread: number;
    randomSeed: number;
  }>;
  normalization: Readonly<{
    targetRadius: number;
    minDistance: number;
    overlapIterations: number;
    themeOffsetStrength: number;
    timeOffsetStrength: number;
  }>;
  processing: Readonly<{
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    totalCount: number;
    minimumDistance: number;
    averageNearestNeighborDistance: number;
  }>;
  positions: readonly LayoutEntry[];
}>;

class PoemLayoutError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PoemLayoutError";
  }
}

function cosineDistance(left: readonly number[], right: readonly number[]): number {
  let dotProduct: number = 0;
  let leftMagnitude: number = 0;
  let rightMagnitude: number = 0;

  for (let index: number = 0; index < left.length; index += 1) {
    const leftValue: number = left[index] ?? 0;
    const rightValue: number = right[index] ?? 0;
    dotProduct += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 1;
  }

  return 1 - dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
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

function parsePoems(source: string, sourceFile: string): Poem[] {
  const validation = poemsSchema.safeParse(JSON.parse(source));
  if (!validation.success) {
    throw new PoemLayoutError(
      `${sourceFile}: 诗歌数据校验失败：`
      + validation.error.issues
        .map((issue: z.ZodIssue): string =>
          `${issue.path.join(".")}: ${issue.message}`,
        )
        .join("；"),
    );
  }

  return validation.data;
}

function parseVectorCache(source: string, sourceFile: string): VectorCache {
  const validation = vectorCacheSchema.safeParse(JSON.parse(source));
  if (!validation.success) {
    throw new PoemLayoutError(
      `${sourceFile}: 向量数据校验失败：`
      + validation.error.issues
        .map((issue: z.ZodIssue): string =>
          `${issue.path.join(".")}: ${issue.message}`,
        )
        .join("；"),
    );
  }

  return validation.data;
}

function createVectorByPoemId(
  vectorCache: VectorCache,
): ReadonlyMap<string, VectorEntry> {
  return new Map<string, VectorEntry>(
    vectorCache.vectors.map((entry: VectorEntry): readonly [string, VectorEntry] => [
      entry.poemId,
      entry,
    ]),
  );
}

function getPoemYear(poem: Poem): string {
  return poem.writtenAt.slice(0, 4);
}

function getOrderedYears(poems: readonly Poem[]): readonly string[] {
  return [...new Set(poems.map(getPoemYear))].sort();
}

function hashText(value: string): number {
  let hash: number = LAYOUT_SEED;
  for (let index: number = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createThemeOffset(collection: string): Position3D {
  const random: () => number = createSeededRandom(hashText(collection));
  const angle: number = random() * Math.PI * 2;
  const height: number = (random() - 0.5) * THEME_OFFSET_STRENGTH;

  return [
    Math.cos(angle) * THEME_OFFSET_STRENGTH,
    height,
    Math.sin(angle) * THEME_OFFSET_STRENGTH,
  ];
}

function createTimeOffset(
  poem: Poem,
  orderedYears: readonly string[],
): Position3D {
  if (orderedYears.length <= 1) {
    return [0, 0, 0];
  }

  const yearIndex: number = orderedYears.indexOf(getPoemYear(poem));
  const normalizedIndex: number = yearIndex / (orderedYears.length - 1);
  return [
    0,
    (normalizedIndex - 0.5) * TIME_OFFSET_STRENGTH,
    (normalizedIndex - 0.5) * TIME_OFFSET_STRENGTH,
  ];
}

function normalizeEmbedding(rawEmbedding: readonly number[][]): Position3D[] {
  const centers: readonly number[] = [0, 1, 2].map((axis: number): number => {
    const values: readonly number[] = rawEmbedding.map(
      (point: readonly number[]): number => point[axis] ?? 0,
    );
    return values.reduce((sum: number, value: number): number =>
      sum + value, 0) / values.length;
  });
  const centered: readonly Position3D[] = rawEmbedding.map(
    (point: readonly number[]): Position3D => [
      (point[0] ?? 0) - centers[0],
      (point[1] ?? 0) - centers[1],
      (point[2] ?? 0) - centers[2],
    ],
  );
  const maxRadius: number = Math.max(
    ...centered.map((point: Position3D): number =>
      Math.sqrt(point[0] ** 2 + point[1] ** 2 + point[2] ** 2),
    ),
    1,
  );

  return centered.map((point: Position3D): Position3D => [
    point[0] / maxRadius * TARGET_RADIUS,
    point[1] / maxRadius * TARGET_RADIUS,
    point[2] / maxRadius * TARGET_RADIUS,
  ]);
}

function addOffsets(
  poems: readonly Poem[],
  positions: readonly Position3D[],
): Position3D[] {
  const orderedYears: readonly string[] = getOrderedYears(poems);
  return positions.map((position: Position3D, index: number): Position3D => {
    const poem: Poem = poems[index];
    const themeOffset: Position3D = createThemeOffset(poem.collection);
    const timeOffset: Position3D = createTimeOffset(poem, orderedYears);

    return [
      position[0] + themeOffset[0] + timeOffset[0],
      position[1] + themeOffset[1] + timeOffset[1],
      position[2] + themeOffset[2] + timeOffset[2],
    ];
  });
}

function getDistance(left: Position3D, right: Position3D): number {
  return Math.sqrt(
    (left[0] - right[0]) ** 2
    + (left[1] - right[1]) ** 2
    + (left[2] - right[2]) ** 2,
  );
}

function resolveOverlaps(positions: readonly Position3D[]): Position3D[] {
  let resolved: Position3D[] = positions.map((position: Position3D): Position3D => [
    position[0],
    position[1],
    position[2],
  ]);

  for (let iteration: number = 0; iteration < OVERLAP_ITERATIONS; iteration += 1) {
    const nextPositions: Position3D[] = resolved.map(
      (position: Position3D): Position3D => [position[0], position[1], position[2]],
    );

    for (let leftIndex: number = 0; leftIndex < resolved.length; leftIndex += 1) {
      for (
        let rightIndex: number = leftIndex + 1;
        rightIndex < resolved.length;
        rightIndex += 1
      ) {
        const left: Position3D = resolved[leftIndex];
        const right: Position3D = resolved[rightIndex];
        const distance: number = getDistance(left, right);
        if (distance >= MIN_DISTANCE) {
          continue;
        }

        const safeDistance: number = distance === 0 ? 0.0001 : distance;
        const push: number = (MIN_DISTANCE - safeDistance) / 2;
        const direction: Position3D = distance === 0
          ? [1, 0, 0]
          : [
            (left[0] - right[0]) / safeDistance,
            (left[1] - right[1]) / safeDistance,
            (left[2] - right[2]) / safeDistance,
          ];

        nextPositions[leftIndex] = [
          nextPositions[leftIndex][0] + direction[0] * push,
          nextPositions[leftIndex][1] + direction[1] * push,
          nextPositions[leftIndex][2] + direction[2] * push,
        ];
        nextPositions[rightIndex] = [
          nextPositions[rightIndex][0] - direction[0] * push,
          nextPositions[rightIndex][1] - direction[1] * push,
          nextPositions[rightIndex][2] - direction[2] * push,
        ];
      }
    }

    resolved = nextPositions;
  }

  return resolved;
}

function roundPosition(position: Position3D): Position3D {
  return [
    Number(position[0].toFixed(POSITION_PRECISION)),
    Number(position[1].toFixed(POSITION_PRECISION)),
    Number(position[2].toFixed(POSITION_PRECISION)),
  ];
}

function getMinimumDistance(positions: readonly Position3D[]): number {
  let minimumDistance: number = Number.POSITIVE_INFINITY;
  for (let leftIndex: number = 0; leftIndex < positions.length; leftIndex += 1) {
    for (
      let rightIndex: number = leftIndex + 1;
      rightIndex < positions.length;
      rightIndex += 1
    ) {
      minimumDistance = Math.min(
        minimumDistance,
        getDistance(positions[leftIndex], positions[rightIndex]),
      );
    }
  }

  return Number((minimumDistance === Number.POSITIVE_INFINITY
    ? 0
    : minimumDistance).toFixed(4));
}

function getAverageNearestNeighborDistance(
  positions: readonly Position3D[],
): number {
  const distances: readonly number[] = positions.map(
    (position: Position3D, index: number): number => {
      const neighborDistances: readonly number[] = positions
        .filter((_: Position3D, otherIndex: number): boolean =>
          otherIndex !== index,
        )
        .map((otherPosition: Position3D): number =>
          getDistance(position, otherPosition),
        );
      return Math.min(...neighborDistances);
    },
  );

  return Number((distances.reduce((sum: number, value: number): number =>
    sum + value, 0) / distances.length).toFixed(4));
}

function createLayoutEntries(
  poems: readonly Poem[],
  positions: readonly Position3D[],
): readonly LayoutEntry[] {
  return poems.map((poem: Poem, index: number): LayoutEntry => ({
    poemId: poem.id,
    title: poem.title,
    collection: poem.collection,
    year: getPoemYear(poem),
    position: positions[index],
  }));
}

function applyPositionsToPoems(
  poems: readonly Poem[],
  positionsByPoemId: ReadonlyMap<string, Position3D>,
): Poem[] {
  return poems.map((poem: Poem): Poem => {
    const position: Position3D | undefined = positionsByPoemId.get(poem.id);
    if (position === undefined) {
      throw new PoemLayoutError(`${poem.id} ${poem.title}: 缺少布局坐标`);
    }

    return {
      ...poem,
      position,
    };
  });
}

async function writeJsonFile(value: unknown, outputFile: string): Promise<void> {
  const outputDirectory: string = path.dirname(outputFile);
  const temporaryFile: string = `${outputFile}.tmp`;
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    temporaryFile,
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryFile, outputFile);
}

async function main(): Promise<void> {
  const startedAt: string = new Date().toISOString();
  const startedMs: number = performance.now();
  const projectRoot: string = process.cwd();
  const poemsFile: string = path.join(projectRoot, "data", "poems.json");
  const vectorFile: string = path.join(projectRoot, "data", "poem-vectors.json");
  const layoutFile: string = path.join(projectRoot, "data", OUTPUT_FILE_NAME);
  const poems: Poem[] = parsePoems(await readFile(poemsFile, "utf8"), poemsFile);
  const vectorCache: VectorCache = parseVectorCache(
    await readFile(vectorFile, "utf8"),
    vectorFile,
  );
  const vectorByPoemId: ReadonlyMap<string, VectorEntry> =
    createVectorByPoemId(vectorCache);
  const vectors: number[][] = poems.map((poem: Poem): number[] => {
    const vectorEntry: VectorEntry | undefined = vectorByPoemId.get(poem.id);
    if (vectorEntry === undefined) {
      throw new PoemLayoutError(`${poem.id} ${poem.title}: 缺少语义向量`);
    }
    return vectorEntry.vector;
  });
  const neighbors: number = Math.min(8, Math.max(2, poems.length - 1));
  const epochs: number = 360;
  const minDist: number = 0.12;
  const spread: number = 1.6;
  const umap: UMAP = new UMAP({
    distanceFn: cosineDistance,
    minDist,
    nComponents: 3,
    nEpochs: epochs,
    nNeighbors: neighbors,
    random: createSeededRandom(LAYOUT_SEED),
    spread,
  });
  const rawEmbedding: number[][] = umap.fit(vectors);
  const normalizedPositions: Position3D[] = normalizeEmbedding(rawEmbedding);
  const offsetPositions: Position3D[] = addOffsets(poems, normalizedPositions);
  const finalPositions: Position3D[] = resolveOverlaps(offsetPositions)
    .map(roundPosition);
  const entries: readonly LayoutEntry[] = createLayoutEntries(
    poems,
    finalPositions,
  );
  const positionsByPoemId: ReadonlyMap<string, Position3D> =
    new Map<string, Position3D>(
      entries.map((entry: LayoutEntry): readonly [string, Position3D] => [
        entry.poemId,
        entry.position,
      ]),
    );
  const finishedAt: string = new Date().toISOString();
  const durationMs: number = Number((performance.now() - startedMs).toFixed(2));
  const layoutOutput: LayoutOutput = {
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    layoutVersion: LAYOUT_VERSION,
    generatedAt: finishedAt,
    sourceVectorModelVersion: vectorCache.model.version,
    sourceVectorDimensions: vectorCache.model.dimensions,
    umap: {
      dimensions: 3,
      neighbors,
      epochs,
      minDist,
      spread,
      randomSeed: LAYOUT_SEED,
    },
    normalization: {
      targetRadius: TARGET_RADIUS,
      minDistance: MIN_DISTANCE,
      overlapIterations: OVERLAP_ITERATIONS,
      themeOffsetStrength: THEME_OFFSET_STRENGTH,
      timeOffsetStrength: TIME_OFFSET_STRENGTH,
    },
    processing: {
      startedAt,
      finishedAt,
      durationMs,
      totalCount: poems.length,
      minimumDistance: getMinimumDistance(finalPositions),
      averageNearestNeighborDistance:
        getAverageNearestNeighborDistance(finalPositions),
    },
    positions: entries,
  };

  await writeJsonFile(layoutOutput, layoutFile);
  await writeJsonFile(applyPositionsToPoems(poems, positionsByPoemId), poemsFile);

  console.log(JSON.stringify({
    event: "poem_layout_built",
    outputFile: layoutFile,
    poemsFile,
    layoutVersion: LAYOUT_VERSION,
    totalCount: poems.length,
    minimumDistance: layoutOutput.processing.minimumDistance,
    averageNearestNeighborDistance:
      layoutOutput.processing.averageNearestNeighborDistance,
    durationMs,
  }));
}

main().catch((error: unknown): void => {
  const message: string = error instanceof Error
    ? error.message
    : "未知错误";
  console.error(JSON.stringify({
    event: "poem_layout_failed",
    message,
  }));
  process.exitCode = 1;
});
