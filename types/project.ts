export type VisualDirection = Readonly<{
  background: string;
  primaryText: string;
  starPalette: string;
  motion: string;
}>;

export type ProjectProfile = Readonly<{
  name: string;
  author: string;
  initialPoemCount: number;
  visualDirection: VisualDirection;
}>;
