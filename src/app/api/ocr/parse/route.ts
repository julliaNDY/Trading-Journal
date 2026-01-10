import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { visionClient, VisionApiError, VisionTimeoutError, VisionQuotaError } from '@/lib/google-vision';
import { parseVisionResponse, parseOcrText, isVisionApiConfigured } from '@/services/ocr-service';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout

// =============================================================================
// CONFIGURATION
// =============================================================================

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB (Vision API limit)
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// =============================================================================
// TYPES
// =============================================================================

interface OcrRequestBody {
  /** Image encodée en Base64 (sans préfixe data:image/...) */
  image: string;
  /** Symbole pour filtrer les ranges de prix (optionnel) */
  symbol?: string;
}

interface OcrErrorResponse {
  error: string;
  code?: string;
  retryable?: boolean;
  details?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Détecte le type MIME d'une image depuis ses magic bytes
 */
function detectMimeType(buffer: Buffer): string {
  if (buffer.length < 4) return 'application/octet-stream';
  
  const bytes = buffer.subarray(0, 12);
  
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  
  // GIF: 47 49 46 38 (GIF8)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  
  // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF....WEBP)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    if (buffer.length >= 12 && 
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }
  }
  
  return 'application/octet-stream';
}

/**
 * Crée une réponse d'erreur formatée
 */
function errorResponse(
  message: string, 
  status: number, 
  options: Partial<OcrErrorResponse> = {}
): NextResponse<OcrErrorResponse> {
  return NextResponse.json(
    { error: message, ...options },
    { status }
  );
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * POST /api/ocr/parse
 * 
 * Analyse une image via OCR et extrait les données de trades.
 * Utilise Google Cloud Vision API si configuré, sinon retourne une erreur.
 * 
 * @body { image: string (base64), symbol?: string }
 * @returns OcrParseResult avec les trades détectés
 */
export async function POST(request: NextRequest) {
  try {
    // =========================================================================
    // 1. AUTHENTICATION
    // =========================================================================
    
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return errorResponse('Unauthorized', 401, { code: 'AUTH_REQUIRED' });
    }

    // =========================================================================
    // 2. PARSE REQUEST BODY
    // =========================================================================
    
    let body: OcrRequestBody;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400, { code: 'INVALID_JSON' });
    }
    
    if (!body.image) {
      return errorResponse('Image is required', 400, { code: 'MISSING_IMAGE' });
    }

    if (typeof body.image !== 'string') {
      return errorResponse('Image must be a base64 string', 400, { code: 'INVALID_IMAGE_TYPE' });
    }

    // =========================================================================
    // 3. VALIDATE IMAGE
    // =========================================================================
    
    // Nettoyer le préfixe data URL si présent
    let base64Image = body.image;
    if (base64Image.includes(',')) {
      base64Image = base64Image.split(',')[1];
    }

    // Décoder pour validation
    let imageBuffer: Buffer;
    try {
      imageBuffer = Buffer.from(base64Image, 'base64');
    } catch {
      return errorResponse('Invalid base64 encoding', 400, { code: 'INVALID_BASE64' });
    }

    // Vérifier la taille
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      return errorResponse(
        'Image too large',
        413,
        { 
          code: 'IMAGE_TOO_LARGE',
          details: `Maximum size is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`
        }
      );
    }

    // Vérifier le format
    const mimeType = detectMimeType(imageBuffer);
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return errorResponse(
        'Invalid image format',
        400,
        { 
          code: 'INVALID_FORMAT',
          details: `Allowed formats: ${ALLOWED_MIME_TYPES.join(', ')}`
        }
      );
    }

    // =========================================================================
    // 4. CHECK VISION API CONFIGURATION
    // =========================================================================
    
    if (!isVisionApiConfigured()) {
      return errorResponse(
        'OCR service not configured',
        503,
        { 
          code: 'SERVICE_UNAVAILABLE',
          details: 'Google Vision API credentials not configured'
        }
      );
    }

    // =========================================================================
    // 5. CALL VISION API
    // =========================================================================
    
    const visionResponse = await visionClient.detectText(base64Image);

    // =========================================================================
    // 6. PARSE RESPONSE
    // =========================================================================
    
    const parseResult = parseVisionResponse(visionResponse, {
      symbol: body.symbol,
      confidenceThreshold: 0.7,
    });

    // Ajouter des métadonnées
    const response = {
      ...parseResult,
      metadata: {
        imageSize: imageBuffer.length,
        mimeType,
        visionApiUsed: true,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    // =========================================================================
    // ERROR HANDLING
    // =========================================================================
    
    console.error('[OCR API Error]', error);

    // Erreurs Vision API typées
    if (error instanceof VisionTimeoutError) {
      return errorResponse(
        'OCR processing timeout',
        504,
        { code: 'TIMEOUT', retryable: true }
      );
    }

    if (error instanceof VisionQuotaError) {
      return errorResponse(
        'API quota exceeded',
        429,
        { code: 'QUOTA_EXCEEDED', retryable: false }
      );
    }

    if (error instanceof VisionApiError) {
      return errorResponse(
        error.message,
        500,
        { code: error.code, retryable: error.retryable }
      );
    }

    // Erreur générique
    return errorResponse(
      'OCR processing failed',
      500,
      { 
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    );
  }
}
