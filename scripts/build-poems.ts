import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { z } from "zod";

import type { Poem, PoemFrontmatter } from "../types/poem";

const DATE_PATTERN: RegExp = /^\d{4}-\d{2}-\d{2}$/;
const POEM_FILE_PATTERN: RegExp = /\.md$/i;

const optionalTextSchema = z
  .string()
  .trim()
  .min(1, "存在字段时不能为空")
  .optional();

const textListSchema = z.array(
  z.string().trim().min(1, "列表项不能为空"),
);

const frontmatterSchema = z
  .object({
    id: z.string().trim().min(1, "编号不能为空"),
    title: z.string().trim().min(1, "标题不能为空"),
    writtenAt: z.string().trim().regex(
      DATE_PATTERN,
      "日期必须使用 YYYY-MM-DD 格式",
    ),
    tags: textListSchema.min(1, "至少需要一个标签"),
    location: optionalTextSchema,
    collection: optionalTextSchema,
    emotions: textListSchema.optional(),
    classicalForms: textListSchema.optional(),
    ciTune: optionalTextSchema,
    quTune: optionalTextSchema,
    featured: z.boolean().optional(),
    rating: z.number().int().min(1).max(5).optional(),
    relatedPoemIds: textListSchema.optional(),
  })
  .strict();

type RawFrontmatter = z.infer<typeof frontmatterSchema>;

class PoemBuildError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PoemBuildError";
  }
}

function isValidCalendarDate(value: string): boolean {
  const date: Date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === value;
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue: z.ZodIssue): string => {
      const field: string = issue.path.join(".") || "frontmatter";
      return `${field}: ${issue.message}`;
    })
    .join("；");
}

function normalizeFrontmatter(
  raw: RawFrontmatter,
  fileName: string,
): PoemFrontmatter {
  if (!isValidCalendarDate(raw.writtenAt)) {
    throw new PoemBuildError(
      `${fileName}: writtenAt 不是有效日期：${raw.writtenAt}`,
    );
  }

  return {
    id: raw.id,
    title: raw.title,
    writtenAt: raw.writtenAt,
    tags: raw.tags,
    location: raw.location ?? null,
    collection: raw.collection ?? "未归档",
    emotions: raw.emotions ?? [],
    classicalForms: raw.classicalForms ?? [],
    ciTune: raw.ciTune ?? null,
    quTune: raw.quTune ?? null,
    featured: raw.featured ?? false,
    rating: raw.rating ?? 3,
    relatedPoemIds: raw.relatedPoemIds ?? [],
  };
}

function parsePoem(source: string, fileName: string): Poem {
  const parsed: matter.GrayMatterFile<string> = matter(source);
  const validation = frontmatterSchema.safeParse(parsed.data);

  if (!validation.success) {
    throw new PoemBuildError(
      `${fileName}: 元数据校验失败：`
      + formatZodIssues(validation.error),
    );
  }

  const content: string = parsed.content.trim();
  if (content.length === 0) {
    throw new PoemBuildError(`${fileName}: 诗歌正文不能为空`);
  }

  const metadata: PoemFrontmatter = normalizeFrontmatter(
    validation.data,
    fileName,
  );

  return {
    ...metadata,
    content,
    position: null,
  };
}

function assertUniqueIds(
  poems: readonly Poem[],
  fileNames: readonly string[],
): void {
  const firstFileById: Map<string, string> = new Map<string, string>();

  poems.forEach((poem: Poem, index: number): void => {
    const firstFile: string | undefined = firstFileById.get(poem.id);
    if (firstFile !== undefined) {
      throw new PoemBuildError(
        `${fileNames[index]}: 编号 ${poem.id} 重复，`
        + `首次出现在 ${firstFile}`,
      );
    }
    firstFileById.set(poem.id, fileNames[index]);
  });
}

async function readPoems(inputDirectory: string): Promise<readonly Poem[]> {
  const entries: readonly string[] = await readdir(inputDirectory);
  const fileNames: readonly string[] = entries
    .filter((fileName: string): boolean => {
      return POEM_FILE_PATTERN.test(fileName)
        && fileName.toLowerCase() !== "readme.md";
    })
    .sort((left: string, right: string): number => {
      return left.localeCompare(right, "zh-CN");
    });

  if (fileNames.length === 0) {
    throw new PoemBuildError(
      `${inputDirectory}: 未找到可构建的诗歌 Markdown 文件`,
    );
  }

  const poems: readonly Poem[] = await Promise.all(
    fileNames.map(async (fileName: string): Promise<Poem> => {
      const filePath: string = path.join(inputDirectory, fileName);
      const source: string = await readFile(filePath, "utf8");
      return parsePoem(source, fileName);
    }),
  );

  assertUniqueIds(poems, fileNames);
  return [...poems].sort((left: Poem, right: Poem): number => {
    return left.id.localeCompare(right.id, "zh-CN", { numeric: true });
  });
}

async function writePoems(
  poems: readonly Poem[],
  outputFile: string,
): Promise<void> {
  const outputDirectory: string = path.dirname(outputFile);
  const temporaryFile: string = `${outputFile}.tmp`;
  const json: string = `${JSON.stringify(poems, null, 2)}\n`;

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(temporaryFile, json, "utf8");
  await rename(temporaryFile, outputFile);
}

async function main(): Promise<void> {
  const projectRoot: string = process.cwd();
  const inputDirectory: string = path.join(
    projectRoot,
    "content",
    "poems",
  );
  const outputFile: string = path.join(projectRoot, "data", "poems.json");
  const poems: readonly Poem[] = await readPoems(inputDirectory);

  await writePoems(poems, outputFile);
  console.log(
    JSON.stringify({
      event: "poems_built",
      inputDirectory,
      outputFile,
      count: poems.length,
    }),
  );
}

main().catch((error: unknown): void => {
  const message: string = error instanceof Error
    ? error.message
    : "未知错误";
  console.error(
    JSON.stringify({
      event: "poems_build_failed",
      message,
    }),
  );
  process.exitCode = 1;
});
