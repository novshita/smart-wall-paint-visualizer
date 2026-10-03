export interface ProjectImage {
  /** Short-lived signed URL; refetch the project to get a fresh one */
  url: string;
  width: number;
  height: number;
  mimeType?: string;
  sizeBytes?: number;
}

export interface Variant {
  variantId: string;
  name: string;
  regions: unknown[]; // typed properly with wall selection (step 5)
  renderUrl?: string;
}

export interface Project {
  _id: string;
  userId: string;
  title: string;
  status: 'draft' | 'saved';
  originalImage: ProjectImage;
  workingImage: ProjectImage;
  thumbnailUrl: string;
  variants: Variant[];
  createdAt: string;
  updatedAt: string;
}

export type UploadEvent =
  { kind: 'progress'; percent: number } | { kind: 'done'; project: Project };
