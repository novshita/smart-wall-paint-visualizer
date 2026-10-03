export type Finish = 'matte' | 'satin' | 'glossy';

export interface Color {
  _id: string;
  code: string;
  name: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
  brand: string;
  family: string;
  finishes: Finish[];
  tags: string[];
  swatchUrl?: string;
}

export interface Pattern {
  _id: string;
  name: string;
  description?: string;
  category: string;
  imageUrl: string;
  tileSize?: { width: number; height: number };
}

export interface PatternPage extends Page<Pattern> {
  categories: string[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Facet {
  value: string;
  count: number;
  sampleHex?: string;
}

export interface ColorFacets {
  families: Facet[];
  brands: Facet[];
  tags: Facet[];
  finishes: Facet[];
}

export interface ColorQuery {
  q?: string;
  family?: string;
  brand?: string;
  finish?: string;
  tag?: string;
  sort?: 'family' | 'name' | 'code';
  page?: number;
  limit?: number;
}

export interface Favorites {
  colors: Color[];
  patterns: Pattern[];
}
