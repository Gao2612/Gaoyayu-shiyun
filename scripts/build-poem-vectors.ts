import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { z } from "zod";

const MODEL_PROVIDER: string = "local";
const MODEL_NAME: string = "chinese-ngram-hash-embedding";
const MODEL_VERSION: string = "local-chinese-ngram-v1";
const VECTOR_DIMENSIONS: number = 128;
const CACHE_SCHEMA_VERSION: number = 1;
const MIN_CLEAN_TEXT_LENGTH: number = 12;
const SHORT_POEM_CONTEXT_SEPARATOR: string = "。";
const EMPTY_TAG_PLACEHOLDER: string = "未标注";
const VECTOR_FILE_NAME: string = "poem-vectors.json";

const textArraySchema = z.array(z.string());

const poemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  writtenAt: z.string().min(1),
  tags: textArraySchema,
  location: z.string().nullable(),
  collection: z.string().min(1),
  emotions: textArraySchema,
  classicalForms: textArraySchema,
  ciTune: z.string().nullable(),
  quTune: z.string().nullable(),
});

const poemsSchema = z.array(poemSchema);

const vectorEntrySchema = z.object({
  poemId: z.string().min(1),
  title: z.string().min(1),
  modelVersion: z.string().min(1),
  inputHash: z.string().min(1),
  vector: z.array(z.number()),
  cleanedTextLength: z.number().int().min(0),
  tagCount: z.number().int().min(0),
  usedEmptyTagRule: z.boolean(),
  usedShortPoemRule: z.boolean(),
  processedAt: z.string().min(1),
});

const vectorCacheSchema = z.object({
  schemaVersion: z.number().int(),
  model: z.object({
    provider: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    dimensions: z.number().int().min(1),
  }),
  generatedAt: z.string().min(1),
  sourceFile: z.string().min(1),
  outputFile: z.string().min(1),
  processing: z.object({
    startedAt: z.string().min(1),
    finishedAt: z.string().min(1),
    durationMs: z.number().min(0),
    totalCount: z.number().int().min(0),
    generatedCount: z.number().int().min(0),
    cacheHitCount: z.number().int().min(0),
  }),
  rules: z.object({
    textCleaning: z.string().min(1),
    shortPoem: z.string().min(1),
    emptyTags: z.string().min(1),
  }),
  vectors: z.array(vectorEntrySchema),
});

type Poem = z.infer<typeof poemSchema>;
type VectorEntry = z.infer<typeof vectorEntrySchema>;
type VectorCache = z.infer<typeof vectorCacheSchema>;

class PoemVectorError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PoemVectorError";
  }
}

function createSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/[，。！？、；：“”‘’《》【】（）()［］\[\]{}…—\-·,.!?;:'"`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEffectiveTags(poem: Poem): readonly string[] {
  const tags: readonly string[] = poem.tags
    .map((tag: string): string => tag.trim())
    .filter((tag: string): boolean => tag.length > 0);

  if (tags.length === 0) {
    return [EMPTY_TAG_PLACEHOLDER];
  }

  return tags;
}

function createMetadataTerms(poem: Poem): readonly string[] {
  const nullableTerms: readonly (string | null)[] = [
    poem.location,
    poem.ciTune,
    poem.quTune,
  ];

  return [
    poem.title,
    poem.collection,
    ...getEffectiveTags(poem),
    ...poem.emotions,
    ...poem.classicalForms,
    ...nullableTerms.filter((term: string | null): term is string =>
      term !== null && term.trim().length > 0,
    ),
  ]
    .map((term: string): string => term.trim())
    .filter((term: string): boolean => term.length > 0);
}

function cleanPoemText(poem: Poem): string {
  const cleanedContent: string = normalizeText(poem.content);
  if (cleanedContent.length >= MIN_CLEAN_TEXT_LENGTH) {
    return cleanedContent;
  }

  const metadataText: string = createMetadataTerms(poem)
    .join(SHORT_POEM_CONTEXT_SEPARATOR);
  return normalizeText(
    `${cleanedContent}${SHORT_POEM_CONTEXT_SEPARATOR}${metadataText}`,
  );
}

function createInputHash(poem: Poem, cleanedText: string): string {
  return createSha256(JSON.stringify({
    modelVersion: MODEL_VERSION,
    poemId: poem.id,
    title: poem.title,
    cleanedText,
    tags: getEffectiveTags(poem),
    collection: poem.collection,
    emotions: poem.emotions,
    classicalForms: poem.classicalForms,
    ciTune: poem.ciTune,
    quTune: poem.quTune,
  }));
}

function createTokenList(value: string): readonly string[] {
  const compactText: string = value.replace(/\s+/g, "");
  const characters: readonly string[] = Array.from(compactText);
  const bigrams: readonly string[] = characters
    .slice(0, Math.max(0, characters.length - 1))
    .map((character: string, index: number): string =>
      `${character}${characters[index + 1]}`,
    );

  return [...characters, ...bigrams];
}

function getTokenIndex(token: string): number {
  const hash: Buffer = createHash("sha256").update(token, "utf8").digest();
  return hash.readUInt32BE(0) % VECTOR_DIMENSIONS;
}

function getTokenSign(token: string): number {
  const hash: Buffer = createHash("sha256").update(`sign:${token}`, "utf8")
    .digest();
  return hash[0] % 2 === 0 ? 1 : -1;
}

function normalizeVector(vector: readonly number[]): readonly number[] {
  const magnitude: number = Math.sqrt(
    vector.reduce((sum: number, value: number): number =>
      sum + value * value, 0),
  );

  if (magnitude === 0) {
    throw new PoemVectorError("向量幅度为 0，无法归一化");
  }

  return vector.map((value: number): number =>
    Number((value / magnitude).toFixed(8)),
  );
}

function createVector(cleanedText: string, metadataTerms: readonly string[]): readonly number[] {
  const vector: number[] = Array.from(
    { length: VECTOR_DIMENSIONS },
    (): number => 0,
  );
  const bodyTokens: readonly string[] = createTokenList(cleanedText);
  const metadataTokens: readonly string[] = metadataTerms.flatMap(
    (term: string): readonly string[] => createTokenList(term),
  );

  bodyTokens.forEach((token: string): void => {
    vector[getTokenIndex(token)] += getTokenSign(token);
  });

  metadataTokens.forEach((token: string): void => {
    vector[getTokenIndex(`meta:${token}`)] += getTokenSign(token) * 1.5;
  });

  return normalizeVector(vector);
}

function parsePoemList(source: string, sourceFile: string): readonly Poem[] {
  const parsed: unknown = JSON.parse(source);
  const validation = poemsSchema.safeParse(parsed);

  if (!validation.success) {
    throw new PoemVectorError(
      `${sourceFile}: 诗歌 JSON 格式校验失败：`
      + validation.error.issues
        .map((issue: z.ZodIssue): string =>
          `${issue.path.join(".")}: ${issue.message}`,
        )
        .join("；"),
    );
  }

  return validation.data;
}

async function readExistingCache(outputFile: string): Promise<VectorCache | null> {
  try {
    const source: string = await readFile(outputFile, "utf8");
    const parsed: unknown = JSON.parse(source);
    const validation = vectorCacheSchema.safeParse(parsed);
    if (!validation.success) {
      return null;
    }
    return validation.data;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function createCacheKey(poemId: string, inputHash: string): string {
  return `${poemId}:${inputHash}`;
}

function createEntryByCacheKey(
  cache: VectorCache | null,
): ReadonlyMap<string, VectorEntry> {
  if (cache === null || cache.model.version !== MODEL_VERSION) {
    return new Map<string, VectorEntry>();
  }

  return new Map<string, VectorEntry>(
    cache.vectors.map((entry: VectorEntry): readonly [string, VectorEntry] => [
      createCacheKey(entry.poemId, entry.inputHash),
      entry,
    ]),
  );
}

function createVectorEntry(
  poem: Poem,
  cachedEntryByKey: ReadonlyMap<string, VectorEntry>,
  generatedAt: string,
): Readonly<{
  entry: VectorEntry;
  fromCache: boolean;
}> {
  const cleanedText: string = cleanPoemText(poem);
  if (cleanedText.length === 0) {
    throw new PoemVectorError(`${poem.id} ${poem.title}: 清洗后正文为空`);
  }

  const effectiveTags: readonly string[] = getEffectiveTags(poem);
  const usedEmptyTagRule: boolean = effectiveTags.includes(
    EMPTY_TAG_PLACEHOLDER,
  );
  const usedShortPoemRule: boolean =
    normalizeText(poem.content).length < MIN_CLEAN_TEXT_LENGTH;
  const inputHash: string = createInputHash(poem, cleanedText);
  const cacheKey: string = createCacheKey(poem.id, inputHash);
  const cachedEntry: VectorEntry | undefined = cachedEntryByKey.get(cacheKey);

  if (cachedEntry !== undefined) {
    return {
      entry: cachedEntry,
      fromCache: true,
    };
  }

  return {
    entry: {
      poemId: poem.id,
      title: poem.title,
      modelVersion: MODEL_VERSION,
      inputHash,
      vector: [...createVector(cleanedText, createMetadataTerms(poem))],
      cleanedTextLength: cleanedText.length,
      tagCount: effectiveTags.length,
      usedEmptyTagRule,
      usedShortPoemRule,
      processedAt: generatedAt,
    },
    fromCache: false,
  };
}

async function writeVectorCache(
  cache: VectorCache,
  outputFile: string,
): Promise<void> {
  const outputDirectory: string = path.dirname(outputFile);
  const temporaryFile: string = `${outputFile}.tmp`;
  const json: string = `${JSON.stringify(cache, null, 2)}\n`;

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(temporaryFile, json, "utf8");
  await rename(temporaryFile, outputFile);
}

async function main(): Promise<void> {
  const startedAt: string = new Date().toISOString();
  const startedMs: number = performance.now();
  const projectRoot: string = process.cwd();
  const sourceFile: string = path.join(projectRoot, "data", "poems.json");
  const outputFile: string = path.join(projectRoot, "data", VECTOR_FILE_NAME);
  const poems: readonly Poem[] = parsePoemList(
    await readFile(sourceFile, "utf8"),
    sourceFile,
  );
  const existingCache: VectorCache | null = await readExistingCache(
    outputFile,
  );
  const cachedEntryByKey: ReadonlyMap<string, VectorEntry> =
    createEntryByCacheKey(existingCache);
  const generatedAt: string = new Date().toISOString();
  let generatedCount: number = 0;
  let cacheHitCount: number = 0;

  const vectors: VectorEntry[] = poems.map((poem: Poem): VectorEntry => {
    try {
      const result: Readonly<{
        entry: VectorEntry;
        fromCache: boolean;
      }> = createVectorEntry(poem, cachedEntryByKey, generatedAt);
      if (result.fromCache) {
        cacheHitCount += 1;
      } else {
        generatedCount += 1;
      }
      return result.entry;
    } catch (error: unknown) {
      const message: string = error instanceof Error
        ? error.message
        : "未知错误";
      throw new PoemVectorError(
        `${poem.id} ${poem.title}: 语义向量生成失败：${message}`,
      );
    }
  });
  const finishedAt: string = new Date().toISOString();
  const durationMs: number = Number((performance.now() - startedMs).toFixed(2));
  const vectorCache: VectorCache = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    model: {
      provider: MODEL_PROVIDER,
      name: MODEL_NAME,
      version: MODEL_VERSION,
      dimensions: VECTOR_DIMENSIONS,
    },
    generatedAt,
    sourceFile,
    outputFile,
    processing: {
      startedAt,
      finishedAt,
      durationMs,
      totalCount: poems.length,
      generatedCount,
      cacheHitCount,
    },
    rules: {
      textCleaning: "NFKC 归一化，移除常见中英文标点，折叠空白。",
      shortPoem: `清洗后少于 ${MIN_CLEAN_TEXT_LENGTH} 字时，追加标题、诗集、标签、情绪、体裁、词牌名和曲牌名作为上下文。`,
      emptyTags: `标签为空时使用“${EMPTY_TAG_PLACEHOLDER}”参与向量生成，并在条目中记录 usedEmptyTagRule。`,
    },
    vectors,
  };

  await writeVectorCache(vectorCache, outputFile);
  console.log(JSON.stringify({
    event: "poem_vectors_built",
    outputFile,
    modelVersion: MODEL_VERSION,
    dimensions: VECTOR_DIMENSIONS,
    totalCount: poems.length,
    generatedCount,
    cacheHitCount,
    durationMs,
  }));
}

main().catch((error: unknown): void => {
  const message: string = error instanceof Error
    ? error.message
    : "未知错误";
  console.error(JSON.stringify({
    event: "poem_vectors_failed",
    message,
  }));
  process.exitCode = 1;
});
