/**
 * Google Cloud Vision API Client
 * 
 * Client singleton pour l'OCR via Google Cloud Vision.
 * Utilise DOCUMENT_TEXT_DETECTION pour une meilleure précision sur les captures d'écran de trading.
 */

import { ImageAnnotatorClient, protos } from '@google-cloud/vision';
import type { 
  VisionAnnotateImageResponse, 
  VisionClientOptions,
  ImageQualityAnalysis,
  ImageQuality,
} from '@/types/google-vision';

// Type from Google's protos
type IAnnotateImageResponse = protos.google.cloud.vision.v1.IAnnotateImageResponse;

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_OPTIONS: Required<VisionClientOptions> = {
  timeout: 30000,        // 30 secondes
  maxRetries: 1,         // 1 retry sur erreurs serveur
  confidenceThreshold: 0.7,
};

// =============================================================================
// ERROR TYPES
// =============================================================================

export class VisionApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'VisionApiError';
  }
}

export class VisionTimeoutError extends VisionApiError {
  constructor() {
    super('Vision API request timeout', 'TIMEOUT', true);
    this.name = 'VisionTimeoutError';
  }
}

export class VisionQuotaError extends VisionApiError {
  constructor() {
    super('Vision API quota exceeded', 'QUOTA_EXCEEDED', false);
    this.name = 'VisionQuotaError';
  }
}

// =============================================================================
// CLIENT CLASS
// =============================================================================

class GoogleVisionClient {
  private client: ImageAnnotatorClient | null = null;
  private options: Required<VisionClientOptions>;
  private requestCount = 0;
  private readonly QUOTA_WARNING_THRESHOLD = 800; // 80% du quota gratuit (1000/mois)

  constructor(options: VisionClientOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Lazy initialization du client Vision API
   */
  private getClient(): ImageAnnotatorClient {
    if (!this.client) {
      // Le client utilise automatiquement GOOGLE_APPLICATION_CREDENTIALS
      // ou les credentials par défaut de l'environnement GCP
      this.client = new ImageAnnotatorClient();
    }
    return this.client;
  }

  /**
   * Détecte le texte dans une image encodée en Base64
   * 
   * @param imageBase64 - Image encodée en Base64 (sans préfixe data:image/...)
   * @returns Réponse Vision API avec fullTextAnnotation
   * @throws VisionApiError en cas d'erreur
   */
  async detectText(imageBase64: string): Promise<VisionAnnotateImageResponse> {
    const client = this.getClient();
    
    const request = {
      image: { content: imageBase64 },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' as const }],
    };

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        // Race entre l'appel API et le timeout
        const [result] = await Promise.race([
          client.annotateImage(request),
          this.createTimeout(),
        ]) as [IAnnotateImageResponse];
        
        // Incrémenter le compteur de requêtes
        this.incrementRequestCount();
        
        // Vérifier si l'API a retourné une erreur
        if (result.error) {
          throw new VisionApiError(
            result.error.message || 'Unknown Vision API error',
            String(result.error.code || 'UNKNOWN'),
            false
          );
        }
        
        // Convertir la réponse au format attendu
        return this.convertResponse(result);
        
      } catch (error) {
        lastError = error as Error;
        
        // Ne retry que sur erreurs retryables
        if (!this.isRetryable(error)) {
          throw this.wrapError(error);
        }
        
        // Attendre avant retry (exponential backoff)
        if (attempt < this.options.maxRetries) {
          await this.sleep(1000 * Math.pow(2, attempt));
        }
      }
    }
    
    throw this.wrapError(lastError);
  }

  /**
   * Analyse la qualité d'une réponse Vision API
   */
  analyzeImageQuality(response: VisionAnnotateImageResponse): ImageQualityAnalysis {
    const confidences: number[] = [];
    let lowConfidenceCount = 0;
    
    for (const page of response.fullTextAnnotation?.pages || []) {
      for (const block of page.blocks || []) {
        const conf = block.confidence ?? 1;
        confidences.push(conf);
        if (conf < this.options.confidenceThreshold) {
          lowConfidenceCount++;
        }
      }
    }
    
    if (confidences.length === 0) {
      return {
        quality: 'poor',
        avgConfidence: 0,
        totalBlocks: 0,
        lowConfidenceBlocks: 0,
        recommendation: 'No text detected in image. Try a clearer screenshot.',
      };
    }
    
    const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const quality: ImageQuality = avg >= 0.85 ? 'good' : avg >= 0.7 ? 'medium' : 'poor';
    
    let recommendation: string | undefined;
    if (quality === 'poor') {
      recommendation = 'Image quality is low. Consider using a higher resolution screenshot.';
    } else if (quality === 'medium') {
      recommendation = 'Some text may not be accurately detected.';
    }
    
    return {
      quality,
      avgConfidence: Math.round(avg * 100) / 100,
      totalBlocks: confidences.length,
      lowConfidenceBlocks: lowConfidenceCount,
      recommendation,
    };
  }

  /**
   * Retourne le statut des quotas
   */
  getQuotaStatus(): { count: number; warning: boolean; percentUsed: number } {
    return {
      count: this.requestCount,
      warning: this.requestCount >= this.QUOTA_WARNING_THRESHOLD,
      percentUsed: Math.round((this.requestCount / 1000) * 100),
    };
  }

  /**
   * Réinitialise le compteur de requêtes (à appeler mensuellement)
   */
  resetQuotaCounter(): void {
    this.requestCount = 0;
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private createTimeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new VisionTimeoutError()), this.options.timeout);
    });
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof VisionTimeoutError) return true;
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('unavailable') ||
        message.includes('deadline_exceeded') ||
        message.includes('internal') ||
        message.includes('503') ||
        message.includes('500')
      );
    }
    return false;
  }

  private wrapError(error: unknown): VisionApiError {
    if (error instanceof VisionApiError) return error;
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('quota') || message.includes('resource_exhausted')) {
        return new VisionQuotaError();
      }
      
      if (message.includes('timeout') || message.includes('deadline')) {
        return new VisionTimeoutError();
      }
      
      return new VisionApiError(
        error.message,
        'UNKNOWN',
        this.isRetryable(error)
      );
    }
    
    return new VisionApiError('Unknown error', 'UNKNOWN', false);
  }

  private convertResponse(result: IAnnotateImageResponse): VisionAnnotateImageResponse {
    // La réponse de Google est structurellement compatible avec notre type simplifié
    // On utilise une assertion de type car les types Google sont plus stricts
    // mais la structure est identique
    
    if (!result.fullTextAnnotation) {
      return {
        fullTextAnnotation: null,
        textAnnotations: result.textAnnotations as VisionAnnotateImageResponse['textAnnotations'],
        error: result.error ? {
          code: result.error.code ?? undefined,
          message: result.error.message ?? undefined,
          details: result.error.details as unknown[] | undefined,
        } : null,
      };
    }

    // Cast direct car la structure est compatible
    return result as unknown as VisionAnnotateImageResponse;
  }

  private incrementRequestCount(): void {
    this.requestCount++;
    
    if (this.requestCount === this.QUOTA_WARNING_THRESHOLD) {
      console.warn('[Vision API] Approaching monthly quota limit (80% used)');
    }
    
    if (this.requestCount === 1000) {
      console.error('[Vision API] Monthly quota limit reached!');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const visionClient = new GoogleVisionClient();

// Export class for testing
export { GoogleVisionClient };
