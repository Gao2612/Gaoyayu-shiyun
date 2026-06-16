export type PoemPosition = readonly [number, number, number];

export type Poem = Readonly<{
  id: string;
  title: string;
  content: string;
  writtenAt: string;
  tags: readonly string[];
  location: string | null;
  collection: string;
  emotions: readonly string[];
  classicalForms: readonly string[];
  ciTune: string | null;
  quTune: string | null;
  featured: boolean;
  rating: number;
  position: PoemPosition | null;
  relatedPoemIds: readonly string[];
}>;

export type PoemFrontmatter = Readonly<{
  id: string;
  title: string;
  writtenAt: string;
  tags: readonly string[];
  location: string | null;
  collection: string;
  emotions: readonly string[];
  classicalForms: readonly string[];
  ciTune: string | null;
  quTune: string | null;
  featured: boolean;
  rating: number;
  relatedPoemIds: readonly string[];
}>;
