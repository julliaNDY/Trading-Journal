/**
 * Types pour Google Cloud Vision API
 * 
 * Ces types sont extraits et simplifiés depuis @google-cloud/vision
 * pour une utilisation plus facile dans notre application.
 */

// =============================================================================
// BOUNDING BOX
// =============================================================================

export interface Vertex {
  x?: number | null;
  y?: number | null;
}

export interface BoundingPoly {
  vertices?: Vertex[] | null;
  normalizedVertices?: Vertex[] | null;
}

// =============================================================================
// TEXT STRUCTURE (Hiérarchique: Page > Block > Paragraph > Word > Symbol)
// =============================================================================

export type BlockType = 
  | 'UNKNOWN'
  | 'TEXT'
  | 'TABLE'
  | 'PICTURE'
  | 'RULER'
  | 'BARCODE';

export type BreakType = 
  | 'UNKNOWN'
  | 'SPACE'
  | 'SURE_SPACE'
  | 'EOL_SURE_SPACE'
  | 'HYPHEN'
  | 'LINE_BREAK';

export interface DetectedBreak {
  type?: BreakType | null;
  isPrefix?: boolean | null;
}

export interface DetectedLanguage {
  languageCode?: string | null;
  confidence?: number | null;
}

export interface TextProperty {
  detectedLanguages?: DetectedLanguage[] | null;
  detectedBreak?: DetectedBreak | null;
}

export interface VisionSymbol {
  property?: TextProperty | null;
  boundingBox?: BoundingPoly | null;
  text?: string | null;
  confidence?: number | null;
}

export interface VisionWord {
  property?: TextProperty | null;
  boundingBox?: BoundingPoly | null;
  symbols?: VisionSymbol[] | null;
  confidence?: number | null;
}

export interface VisionParagraph {
  property?: TextProperty | null;
  boundingBox?: BoundingPoly | null;
  words?: VisionWord[] | null;
  confidence?: number | null;
}

export interface VisionBlock {
  property?: TextProperty | null;
  boundingBox?: BoundingPoly | null;
  paragraphs?: VisionParagraph[] | null;
  blockType?: BlockType | string | null;
  confidence?: number | null;
}

export interface VisionPage {
  property?: TextProperty | null;
  width?: number | null;
  height?: number | null;
  blocks?: VisionBlock[] | null;
  confidence?: number | null;
}

export interface FullTextAnnotation {
  pages?: VisionPage[] | null;
  text?: string | null;
}

// =============================================================================
// API RESPONSE
// =============================================================================

export interface EntityAnnotation {
  mid?: string | null;
  locale?: string | null;
  description?: string | null;
  score?: number | null;
  confidence?: number | null;
  topicality?: number | null;
  boundingPoly?: BoundingPoly | null;
}

export interface Status {
  code?: number | null;
  message?: string | null;
  details?: unknown[] | null;
}

export interface VisionAnnotateImageResponse {
  fullTextAnnotation?: FullTextAnnotation | null;
  textAnnotations?: EntityAnnotation[] | null;
  error?: Status | null;
}

// =============================================================================
// PARSED LINE (Notre structure interne pour le parsing)
// =============================================================================

export interface ParsedWord {
  text: string;
  confidence: number;
  bounds?: BoundingPoly | null;
}

export interface ParsedLine {
  text: string;
  confidence: number;
  words: ParsedWord[];
  lineIndex: number;
}

// =============================================================================
// QUALITY ANALYSIS
// =============================================================================

export type ImageQuality = 'good' | 'medium' | 'poor';

export interface ImageQualityAnalysis {
  quality: ImageQuality;
  avgConfidence: number;
  totalBlocks: number;
  lowConfidenceBlocks: number;
  recommendation?: string;
}

// =============================================================================
// VISION CLIENT OPTIONS
// =============================================================================

export interface VisionClientOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Max retries on server errors (default: 1) */
  maxRetries?: number;
  /** Minimum confidence threshold (default: 0.7) */
  confidenceThreshold?: number;
}

export interface DetectTextOptions {
  /** Symbol to help with price range filtering */
  symbol?: string;
  /** Override default confidence threshold */
  confidenceThreshold?: number;
}
