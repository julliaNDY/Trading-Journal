import { NextRequest, NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';
import { parseOcrText, type OcrParseResult } from '@/services/ocr-service';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for OCR

/**
 * POST /api/ocr/parse
 * 
 * Traite une image via OCR et extrait les trades
 * 
 * Body: FormData avec:
 * - image: File (image à traiter)
 * - symbol: string (optionnel, pour filtrer les ranges de prix)
 * 
 * Response: OcrParseResult
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const symbol = formData.get('symbol') as string | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'Image file is required' },
        { status: 400 }
      );
    }

    // Convertit le fichier en buffer pour Tesseract
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Prétraitement de l'image (optionnel - pour améliorer l'OCR)
    // Note: Pour un traitement plus avancé, on pourrait utiliser sharp ici
    const processedImage = buffer;

    // Execute OCR avec Tesseract.js
    const result = await Tesseract.recognize(
      processedImage,
      'eng',
      {
        // Options Tesseract pour améliorer la reconnaissance
        // logger: (m) => console.log(m), // Debug uniquement
      }
    );

    const ocrText = result.data.text;

    // Parse le texte OCR pour extraire les trades
    const parseResult: OcrParseResult = parseOcrText(ocrText, symbol ?? undefined);

    return NextResponse.json(parseResult);
  } catch (error) {
    console.error('OCR API error:', error);
    return NextResponse.json(
      { 
        error: 'OCR processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

