# 📋 Spécifications Techniques : Migration OCR vers Google Cloud Vision API

> **Document** : PRD-OCR-VISION-001  
> **Version** : 1.0  
> **Date** : 2026-01-08  
> **Auteur** : John (PM)  
> **Status** : Draft - En attente de validation

---

## 📑 Table des matières

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Analyse de l'Existant](#2-analyse-de-lexistant)
3. [Architecture & Flux de Données](#3-architecture--flux-de-données)
4. [User Stories & Tâches Techniques](#4-user-stories--tâches-techniques)
5. [Gestion des Erreurs & Edge Cases](#5-gestion-des-erreurs--edge-cases)
6. [Plan d'Implémentation](#6-plan-dimplémentation)
7. [Tests & Validation](#7-tests--validation)
8. [Annexes](#8-annexes)

---

## 1. Résumé Exécutif

### 1.1 Contexte

Le module OCR actuel utilise **Tesseract.js** pour extraire les données de trades depuis des captures d'écran. Cette solution présente plusieurs limitations :

| Problème | Impact |
|----------|--------|
| Bundle client ~7MB | Performance de chargement dégradée |
| Précision OCR ~75-85% | Nombreux faux positifs, regex complexes |
| Pas de confidence score | Impossible de filtrer les résultats incertains |
| Preprocessing manuel | 50+ lignes de manipulation canvas |

### 1.2 Solution Proposée

Migration vers **Google Cloud Vision API** (Document Text Detection) :

| Avantage | Bénéfice |
|----------|----------|
| Précision ~95%+ | Moins de regex, parsing simplifié |
| Confidence scores | Filtrage intelligent des résultats |
| Traitement serveur | Bundle client allégé de 7MB |
| Structure hiérarchique | Blocks → Paragraphs → Words → Symbols |
| Support multi-langues | Détection automatique FR/EN |

### 1.3 Estimation

| Phase | Durée | Complexité |
|-------|-------|------------|
| Configuration GCP | 2h | Faible |
| Service Backend OCR | 4h | Moyenne |
| Refonte Parsing | 6h | Haute |
| Migration Frontend | 3h | Moyenne |
| Tests & QA | 3h | Moyenne |
| **Total** | **18h** | - |

---

## 2. Analyse de l'Existant

### 2.1 Architecture Actuelle

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│  ocr-import-dialog.tsx                                          │
│  ├── Image preprocessing (canvas manipulation)                   │
│  ├── Tesseract.recognize() ~7MB WASM                            │
│  └── parseOcrText() → OcrTradeData[]                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ocr-service.ts (Shared)                       │
├─────────────────────────────────────────────────────────────────┤
│  • findDateTimes()      - Regex patterns date/time              │
│  • extractPrices()      - Regex avec correction erreurs OCR     │
│  • extractPnL()         - Regex multi-formats ($, €, etc.)      │
│  • extractQuantity()    - Regex +1, -2, etc.                    │
│  • extractDrawdownRunup() - Regex MAE/MFE                       │
│  • parseOcrText()       - Orchestration parsing                 │
│  • consolidateRawRows() - Groupement partial exits              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Fichiers Impactés

| Fichier | Lignes | Action |
|---------|--------|--------|
| `src/components/import/ocr-import-dialog.tsx` | 505 | **Modifier** - Supprimer Tesseract, appeler API |
| `src/services/ocr-service.ts` | 600 | **Modifier** - Adapter parsing pour Vision API |
| `src/app/api/ocr/parse/route.ts` | 75 | **Remplacer** - Intégrer Vision API |
| `src/lib/google-vision.ts` | - | **Créer** - Client Vision API |
| `src/types/google-vision.d.ts` | - | **Créer** - Types TypeScript |

### 2.3 Dépendances à Modifier

```json
// À SUPPRIMER de package.json
"tesseract.js": "^5.x.x"

// À AJOUTER
"@google-cloud/vision": "^4.x.x"
```

---

## 3. Architecture & Flux de Données

### 3.1 Nouvelle Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│  ocr-import-dialog.tsx                                          │
│  ├── FileReader → Base64                                        │
│  ├── POST /api/ocr/parse { image: base64, symbol?: string }     │
│  └── Display OcrParseResult                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Route (Server)                            │
│                 /api/ocr/parse/route.ts                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Authenticate user (Supabase)                                │
│  2. Validate image (size, format)                               │
│  3. Call Google Vision API                                      │
│  4. Parse structured response                                   │
│  5. Return OcrParseResult                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Google Cloud Vision API                         │
│              DOCUMENT_TEXT_DETECTION                             │
├─────────────────────────────────────────────────────────────────┤
│  Input:  { image: { content: base64 } }                         │
│  Output: { fullTextAnnotation: { pages: [...], text: string } } │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ocr-service.ts (Server)                       │
├─────────────────────────────────────────────────────────────────┤
│  • parseVisionResponse() - Traite structure Vision API          │
│  • extractTradesFromBlocks() - Nouveau parser optimisé          │
│  • (conserve) parseOcrText() - Fallback/compatibilité           │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Méthode d'Envoi de l'Image

**Décision : Base64 (pas URL)**

| Critère | Base64 | URL Signée |
|---------|--------|------------|
| Latence | ✅ Direct | ❌ Upload → Sign → Fetch |
| Complexité | ✅ Simple | ❌ Nécessite Storage |
| Coût | ✅ Gratuit | ❌ Stockage + Transfer |
| Sécurité | ✅ Pas d'URL exposée | ⚠️ URL temporaire |
| Limite taille | ⚠️ 10MB max | ✅ Pas de limite |

**Justification** : Les captures d'écran de trading font généralement 100KB-2MB. La limite de 10MB de Vision API en Base64 est largement suffisante.

### 3.3 Gestion des Credentials

#### Option A : Service Account Key (Recommandé pour VPS)

```bash
# .env
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

```typescript
// src/lib/google-vision.ts
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Le client utilise automatiquement GOOGLE_APPLICATION_CREDENTIALS
const client = new ImageAnnotatorClient();
```

#### Option B : API Key (Alternative simplifiée)

```bash
# .env
GOOGLE_VISION_API_KEY="AIza..."
```

```typescript
// Appel REST direct
const response = await fetch(
  `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: base64Image },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      }],
    }),
  }
);
```

**Recommandation** : Service Account pour production (meilleure sécurité, quotas par projet), API Key pour développement rapide.

### 3.4 Structure de la Réponse Google Vision

```typescript
// Types simplifiés - voir Annexe A pour types complets
interface VisionResponse {
  fullTextAnnotation: {
    text: string;  // Texte complet détecté
    pages: VisionPage[];
  };
  textAnnotations?: VisionTextAnnotation[];  // Legacy format
}

interface VisionPage {
  blocks: VisionBlock[];
  confidence: number;
  width: number;
  height: number;
}

interface VisionBlock {
  blockType: 'TEXT' | 'TABLE' | 'PICTURE' | 'RULER' | 'BARCODE';
  paragraphs: VisionParagraph[];
  confidence: number;
  boundingBox: BoundingPoly;
}

interface VisionParagraph {
  words: VisionWord[];
  confidence: number;
  boundingBox: BoundingPoly;
}

interface VisionWord {
  symbols: VisionSymbol[];
  confidence: number;
  boundingBox: BoundingPoly;
  // Texte reconstitué
  text: string;  // Nous ajouterons cette propriété calculée
}

interface VisionSymbol {
  text: string;
  confidence: number;
  boundingBox: BoundingPoly;
  property?: {
    detectedBreak?: {
      type: 'SPACE' | 'SURE_SPACE' | 'EOL_SURE_SPACE' | 'HYPHEN' | 'LINE_BREAK';
    };
  };
}
```

### 3.5 Stratégie de Parsing

**Approche hybride** : Utiliser la structure hiérarchique quand disponible, fallback sur le texte brut.

```typescript
// src/services/ocr-service.ts (nouvelle fonction)

export function parseVisionResponse(
  response: VisionResponse, 
  symbol?: string
): OcrParseResult {
  // 1. Extraire le texte brut (toujours disponible)
  const rawText = response.fullTextAnnotation?.text || '';
  
  // 2. Si structure disponible, parser par lignes avec confidence
  if (response.fullTextAnnotation?.pages?.length > 0) {
    return parseStructuredVisionData(response.fullTextAnnotation, symbol);
  }
  
  // 3. Fallback sur le parsing texte existant
  return parseOcrText(rawText, symbol);
}

function parseStructuredVisionData(
  fullText: FullTextAnnotation,
  symbol?: string
): OcrParseResult {
  const lines: ParsedLine[] = [];
  
  for (const page of fullText.pages) {
    for (const block of page.blocks) {
      if (block.blockType !== 'TEXT') continue;
      if (block.confidence < 0.7) continue; // Filtre basse confiance
      
      for (const paragraph of block.paragraphs) {
        const lineText = extractLineText(paragraph);
        const lineConfidence = paragraph.confidence;
        
        lines.push({
          text: lineText,
          confidence: lineConfidence,
          words: paragraph.words.map(w => ({
            text: getWordText(w),
            confidence: w.confidence,
            bounds: w.boundingBox,
          })),
        });
      }
    }
  }
  
  // Parser les lignes avec le contexte de confiance
  return parseLinesToTrades(lines, symbol);
}
```

---

## 4. User Stories & Tâches Techniques

### 4.1 Epic : Migration OCR vers Google Cloud Vision

---

#### Story 4.1.1 : Configuration Projet GCP

**En tant que** développeur  
**Je veux** configurer un projet Google Cloud avec Vision API  
**Afin de** pouvoir utiliser l'API de détection de texte

**Critères d'Acceptation :**

- [ ] Projet GCP créé avec nom explicite (`trading-journal-ocr`)
- [ ] Vision API activée dans le projet
- [ ] Service Account créé avec rôle `Cloud Vision API User`
- [ ] Clé JSON générée et stockée sécurisément
- [ ] Variable `GOOGLE_APPLICATION_CREDENTIALS` documentée
- [ ] Quota alerting configuré (1000 requêtes/mois gratuit)

**Tâches :**

| # | Tâche | Estimation |
|---|-------|------------|
| 1 | Créer projet GCP via Console | 10min |
| 2 | Activer Cloud Vision API | 5min |
| 3 | Créer Service Account | 10min |
| 4 | Générer et télécharger clé JSON | 5min |
| 5 | Ajouter au `.gitignore` | 2min |
| 6 | Documenter dans `env.example` | 5min |
| 7 | Configurer alertes quota | 10min |

---

#### Story 4.1.2 : Client Google Vision (Backend)

**En tant que** développeur backend  
**Je veux** un client Vision API réutilisable  
**Afin de** centraliser la configuration et la gestion d'erreurs

**Critères d'Acceptation :**

- [ ] Module `src/lib/google-vision.ts` créé
- [ ] Client singleton avec lazy initialization
- [ ] Méthode `detectText(imageBase64: string): Promise<VisionResponse>`
- [ ] Gestion timeout configurable (default 30s)
- [ ] Retry automatique (1 retry sur 5xx)
- [ ] Types TypeScript complets
- [ ] Logging structuré (pas de console.log)

**Tâches :**

| # | Tâche | Fichier | Estimation |
|---|-------|---------|------------|
| 1 | Installer `@google-cloud/vision` | `package.json` | 5min |
| 2 | Créer types Vision API | `src/types/google-vision.d.ts` | 30min |
| 3 | Implémenter client singleton | `src/lib/google-vision.ts` | 45min |
| 4 | Ajouter retry logic | `src/lib/google-vision.ts` | 20min |
| 5 | Tests unitaires | `src/lib/__tests__/google-vision.test.ts` | 30min |

**Code Cible :**

```typescript
// src/lib/google-vision.ts
import { ImageAnnotatorClient } from '@google-cloud/vision';
import type { google } from '@google-cloud/vision/build/protos/protos';

type VisionResponse = google.cloud.vision.v1.IAnnotateImageResponse;

class GoogleVisionClient {
  private client: ImageAnnotatorClient | null = null;
  private readonly maxRetries = 1;
  private readonly timeout = 30000; // 30s

  private getClient(): ImageAnnotatorClient {
    if (!this.client) {
      this.client = new ImageAnnotatorClient();
    }
    return this.client;
  }

  async detectText(imageBase64: string): Promise<VisionResponse> {
    const client = this.getClient();
    
    const request = {
      image: { content: imageBase64 },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' as const }],
    };

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const [result] = await Promise.race([
          client.annotateImage(request),
          this.createTimeout(),
        ]);
        
        if (result.error) {
          throw new Error(`Vision API error: ${result.error.message}`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Ne retry que sur erreurs serveur
        if (!this.isRetryable(error)) {
          throw error;
        }
        
        // Attendre avant retry (exponential backoff)
        await this.sleep(1000 * (attempt + 1));
      }
    }
    
    throw lastError;
  }

  private createTimeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Vision API timeout')), this.timeout);
    });
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      // Retry sur erreurs 5xx ou réseau
      return error.message.includes('5') || 
             error.message.includes('UNAVAILABLE') ||
             error.message.includes('DEADLINE_EXCEEDED');
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton export
export const visionClient = new GoogleVisionClient();
```

---

#### Story 4.1.3 : Refonte API Route OCR

**En tant que** développeur backend  
**Je veux** modifier `/api/ocr/parse` pour utiliser Google Vision  
**Afin de** améliorer la précision de détection

**Critères d'Acceptation :**

- [ ] Route accepte `{ image: string (base64), symbol?: string }`
- [ ] Validation taille image (max 10MB)
- [ ] Validation format (JPEG, PNG, WebP, GIF)
- [ ] Appel Google Vision via client centralisé
- [ ] Parsing via `parseVisionResponse()`
- [ ] Retour `OcrParseResult` compatible avec l'existant
- [ ] Gestion erreurs avec codes appropriés (400, 401, 413, 500, 503)

**Tâches :**

| # | Tâche | Estimation |
|---|-------|------------|
| 1 | Supprimer import Tesseract | 5min |
| 2 | Ajouter validation image | 20min |
| 3 | Intégrer visionClient | 15min |
| 4 | Adapter response parsing | 30min |
| 5 | Tests d'intégration | 45min |

**Code Cible :**

```typescript
// src/app/api/ocr/parse/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { visionClient } from '@/lib/google-vision';
import { parseVisionResponse } from '@/services/ocr-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface OcrRequestBody {
  image: string;  // Base64
  symbol?: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse body
    const body: OcrRequestBody = await request.json();
    
    if (!body.image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // 3. Validate image
    const imageBuffer = Buffer.from(body.image, 'base64');
    
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Image too large', maxSize: '10MB' }, 
        { status: 413 }
      );
    }

    // Detect MIME type from magic bytes
    const mimeType = detectMimeType(imageBuffer);
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: 'Invalid image format', allowed: ALLOWED_TYPES }, 
        { status: 400 }
      );
    }

    // 4. Call Vision API
    const visionResponse = await visionClient.detectText(body.image);

    // 5. Parse response
    const parseResult = parseVisionResponse(visionResponse, body.symbol);

    return NextResponse.json(parseResult);
    
  } catch (error) {
    console.error('[OCR API Error]', error);
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'OCR processing timeout', retryable: true }, 
          { status: 504 }
        );
      }
      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'API quota exceeded', retryable: false }, 
          { status: 429 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'OCR processing failed' }, 
      { status: 500 }
    );
  }
}

function detectMimeType(buffer: Buffer): string {
  const magicBytes = buffer.subarray(0, 4);
  
  // JPEG: FF D8 FF
  if (magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47
  if (magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47) {
    return 'image/png';
  }
  // GIF: 47 49 46 38
  if (magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46) {
    return 'image/gif';
  }
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46) {
    return 'image/webp';
  }
  
  return 'application/octet-stream';
}
```

---

#### Story 4.1.4 : Nouveau Parser Vision API

**En tant que** développeur backend  
**Je veux** un parser optimisé pour les réponses Google Vision  
**Afin de** exploiter la structure hiérarchique et les scores de confiance

**Critères d'Acceptation :**

- [ ] Fonction `parseVisionResponse()` créée
- [ ] Exploitation de la structure blocks/paragraphs/words
- [ ] Filtrage par confidence score (seuil configurable, default 0.7)
- [ ] Fallback sur `parseOcrText()` si structure absente
- [ ] Compatibilité totale avec `OcrParseResult` existant
- [ ] Tests unitaires avec snapshots de réponses Vision API

**Tâches :**

| # | Tâche | Estimation |
|---|-------|------------|
| 1 | Créer `parseVisionResponse()` | 1h |
| 2 | Implémenter `extractLineText()` helper | 30min |
| 3 | Adapter `parseLinesToTrades()` | 1h |
| 4 | Ajouter confidence filtering | 20min |
| 5 | Tests avec mocks Vision | 1h |

**Code Cible :**

```typescript
// Ajout à src/services/ocr-service.ts

import type { google } from '@google-cloud/vision/build/protos/protos';

type FullTextAnnotation = google.cloud.vision.v1.ITextAnnotation;
type Block = google.cloud.vision.v1.IBlock;
type Paragraph = google.cloud.vision.v1.IParagraph;
type Word = google.cloud.vision.v1.IWord;
type Symbol = google.cloud.vision.v1.ISymbol;

const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

export interface VisionParseOptions {
  confidenceThreshold?: number;
  symbol?: string;
}

export function parseVisionResponse(
  response: google.cloud.vision.v1.IAnnotateImageResponse,
  options: VisionParseOptions = {}
): OcrParseResult {
  const { 
    confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
    symbol 
  } = options;

  const fullText = response.fullTextAnnotation;
  
  // Si pas de structure, fallback sur le texte brut
  if (!fullText?.pages?.length) {
    const rawText = fullText?.text || '';
    return parseOcrText(rawText, symbol);
  }

  const warnings: string[] = [];
  const lines: string[] = [];
  let lowConfidenceCount = 0;

  // Extraire les lignes depuis la structure
  for (const page of fullText.pages) {
    for (const block of page.blocks || []) {
      // Skip blocs non-texte
      if (block.blockType !== 'TEXT') continue;
      
      for (const paragraph of block.paragraphs || []) {
        const confidence = paragraph.confidence ?? 1;
        
        if (confidence < confidenceThreshold) {
          lowConfidenceCount++;
          continue;
        }

        const lineText = extractParagraphText(paragraph);
        if (lineText.trim()) {
          lines.push(lineText);
        }
      }
    }
  }

  if (lowConfidenceCount > 0) {
    warnings.push(`${lowConfidenceCount} paragraphe(s) ignoré(s) (confiance < ${confidenceThreshold * 100}%)`);
  }

  // Reconstituer le texte et parser
  const reconstructedText = lines.join('\n');
  const result = parseOcrText(reconstructedText, symbol);

  return {
    ...result,
    rawText: fullText.text || reconstructedText,
    warnings: [...result.warnings, ...warnings],
  };
}

/**
 * Extrait le texte d'un paragraphe en reconstituant les espaces
 */
function extractParagraphText(paragraph: Paragraph): string {
  const parts: string[] = [];

  for (const word of paragraph.words || []) {
    let wordText = '';
    
    for (const symbol of word.symbols || []) {
      wordText += symbol.text || '';
      
      // Ajouter espace/newline selon le break type
      const breakType = symbol.property?.detectedBreak?.type;
      if (breakType === 'SPACE' || breakType === 'SURE_SPACE') {
        wordText += ' ';
      } else if (breakType === 'EOL_SURE_SPACE' || breakType === 'LINE_BREAK') {
        wordText += '\n';
      }
    }
    
    parts.push(wordText);
  }

  return parts.join('').trim();
}

/**
 * Calcule le texte d'un mot (helper)
 */
function getWordText(word: Word): string {
  return (word.symbols || []).map(s => s.text || '').join('');
}
```

---

#### Story 4.1.5 : Refonte Frontend OCR Dialog

**En tant que** utilisateur  
**Je veux** que l'import OCR soit plus rapide et fiable  
**Afin de** réduire les erreurs de reconnaissance

**Critères d'Acceptation :**

- [ ] Tesseract.js supprimé du composant
- [ ] Image convertie en Base64 côté client
- [ ] Appel API `POST /api/ocr/parse` avec body JSON
- [ ] Loader amélioré avec message de progression
- [ ] Gestion erreurs réseau avec retry manuel
- [ ] Préservation de toute l'UX existante (preview, symbol input, etc.)

**Tâches :**

| # | Tâche | Estimation |
|---|-------|------------|
| 1 | Supprimer import Tesseract | 5min |
| 2 | Créer fonction `imageToBase64()` | 15min |
| 3 | Remplacer `handleFileChange()` | 30min |
| 4 | Adapter états de chargement | 20min |
| 5 | Améliorer messages d'erreur | 15min |
| 6 | Tester sur différents navigateurs | 30min |

**Code Cible :**

```typescript
// src/components/import/ocr-import-dialog.tsx (extrait)

// SUPPRIMER: import Tesseract from 'tesseract.js';

// AJOUTER:
async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extraire la partie base64 (retirer le préfixe data:image/xxx;base64,)
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// MODIFIER handleFileChange:
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Validation côté client
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    toast({
      title: tCommon('error'),
      description: tTrades('imageTooLarge'),
      variant: 'destructive',
    });
    e.target.value = '';
    return;
  }

  setIsProcessingOcr(true);
  setOcrProgress('converting'); // Nouveau état

  try {
    // 1. Convertir en Base64
    const base64Image = await imageToBase64(file);
    
    setOcrProgress('analyzing'); // Nouveau état

    // 2. Appeler l'API
    const response = await fetch('/api/ocr/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Image,
        symbol: symbol || undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'OCR failed');
    }

    const result: OcrParseResult = await response.json();
    
    setRawOcrText(result.rawText);
    
    if (result.trades.length > 0) {
      setParsedTrades(result.trades);
      onOpenChange(false);
      setShowConfirmDialog(true);
    } else if (result.rawText.trim()) {
      // Texte détecté mais pas de trades parsés
      onOpenChange(false);
      setShowConfirmDialog(true);
      toast({
        title: tCommon('info'),
        description: tTrades('enterSymbolToReparse'),
      });
    } else {
      toast({
        title: tCommon('info'),
        description: tTrades('ocrNoMatches'),
      });
    }

    // Afficher les warnings éventuels
    if (result.warnings.length > 0) {
      console.warn('OCR warnings:', result.warnings);
    }

  } catch (error) {
    console.error('OCR error:', error);
    
    let description = tTrades('ocrError');
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        description = tTrades('ocrTimeout');
      } else if (error.message.includes('quota')) {
        description = tTrades('ocrQuotaExceeded');
      }
    }
    
    toast({
      title: tCommon('error'),
      description,
      variant: 'destructive',
    });
  } finally {
    setIsProcessingOcr(false);
    setOcrProgress(null);
    e.target.value = '';
  }
};
```

---

#### Story 4.1.6 : Nettoyage & Suppression Tesseract

**En tant que** développeur  
**Je veux** supprimer Tesseract.js du projet  
**Afin de** réduire la taille du bundle client de ~7MB

**Critères d'Acceptation :**

- [ ] `tesseract.js` supprimé de `package.json`
- [ ] Aucun import Tesseract restant dans le code
- [ ] Bundle size vérifié (diff avant/après)
- [ ] Build réussi sans erreurs

**Tâches :**

| # | Tâche | Estimation |
|---|-------|------------|
| 1 | `npm uninstall tesseract.js` | 2min |
| 2 | Grep tous les imports Tesseract | 5min |
| 3 | Supprimer imports résiduels | 10min |
| 4 | Vérifier build | 5min |
| 5 | Comparer bundle size | 10min |

---

### 4.2 Récapitulatif Stories

| # | Story | Estimation | Priorité | Dépendances |
|---|-------|------------|----------|-------------|
| 4.1.1 | Configuration GCP | 45min | P0 | - |
| 4.1.2 | Client Vision Backend | 2h | P0 | 4.1.1 |
| 4.1.3 | Refonte API Route | 2h | P0 | 4.1.2 |
| 4.1.4 | Nouveau Parser | 3h | P0 | 4.1.2 |
| 4.1.5 | Refonte Frontend | 2h | P0 | 4.1.3 |
| 4.1.6 | Cleanup Tesseract | 30min | P1 | 4.1.5 |

**Chemin critique** : 4.1.1 → 4.1.2 → 4.1.3/4.1.4 (parallèle) → 4.1.5 → 4.1.6

---

## 5. Gestion des Erreurs & Edge Cases

### 5.1 Matrice des Erreurs

| Scénario | Détection | Réponse API | Action UI |
|----------|-----------|-------------|-----------|
| Image floue | `confidence < 0.5` sur >50% des blocs | `{ trades: [], warnings: ["Low quality image"] }` | Toast warning + suggestion re-upload |
| Image trop grande | `buffer.length > 10MB` | `413 { error: "Image too large" }` | Toast error + limite affichée |
| Format invalide | Magic bytes check | `400 { error: "Invalid format" }` | Toast error + formats acceptés |
| Timeout Vision API | `DEADLINE_EXCEEDED` | `504 { error: "Timeout", retryable: true }` | Toast + bouton "Réessayer" |
| Quota dépassé | `RESOURCE_EXHAUSTED` | `429 { error: "Quota exceeded" }` | Toast error + contact admin |
| Erreur réseau | `fetch` throws | N/A | Toast + bouton "Réessayer" |
| Pas de texte détecté | `fullTextAnnotation.text === ''` | `{ trades: [], rawText: '' }` | Toast info "Aucun texte détecté" |
| Texte détecté, pas de trades | Trades array vide | `{ trades: [], rawText: "..." }` | Dialog avec input symbole |

### 5.2 Gestion Image Floue

```typescript
// src/services/ocr-service.ts

export function analyzeImageQuality(
  response: VisionResponse
): { quality: 'good' | 'medium' | 'poor'; avgConfidence: number } {
  const confidences: number[] = [];
  
  for (const page of response.fullTextAnnotation?.pages || []) {
    for (const block of page.blocks || []) {
      if (block.confidence !== undefined) {
        confidences.push(block.confidence);
      }
    }
  }
  
  if (confidences.length === 0) {
    return { quality: 'poor', avgConfidence: 0 };
  }
  
  const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  
  return {
    quality: avg >= 0.85 ? 'good' : avg >= 0.7 ? 'medium' : 'poor',
    avgConfidence: avg,
  };
}
```

### 5.3 Retry Strategy

```typescript
// src/components/import/ocr-import-dialog.tsx

const [retryCount, setRetryCount] = useState(0);
const MAX_RETRIES = 2;

const handleRetry = async () => {
  if (retryCount >= MAX_RETRIES) {
    toast({
      title: tCommon('error'),
      description: tTrades('maxRetriesReached'),
      variant: 'destructive',
    });
    return;
  }
  
  setRetryCount(prev => prev + 1);
  // Re-trigger avec la dernière image
  if (lastImageBase64) {
    await processImage(lastImageBase64);
  }
};
```

### 5.4 Quotas API

**Google Cloud Vision - Free Tier :**
- 1000 requêtes/mois gratuites
- $1.50 pour 1000 requêtes supplémentaires

**Monitoring recommandé :**

```typescript
// src/lib/google-vision.ts

let requestCount = 0;
const QUOTA_WARNING_THRESHOLD = 800; // 80% du quota gratuit

export function getQuotaStatus(): { count: number; warning: boolean } {
  return {
    count: requestCount,
    warning: requestCount >= QUOTA_WARNING_THRESHOLD,
  };
}

// Dans detectText():
requestCount++;
if (requestCount === QUOTA_WARNING_THRESHOLD) {
  console.warn('[Vision API] Approaching quota limit');
  // TODO: Envoyer alerte admin
}
```

---

## 6. Plan d'Implémentation

### 6.1 Ordre des Opérations

```
Phase 1: Setup (sans casser l'existant)
├── 1. Configurer projet GCP et credentials
├── 2. Installer @google-cloud/vision
├── 3. Créer src/lib/google-vision.ts
├── 4. Créer src/types/google-vision.d.ts
└── 5. Ajouter variables env (GOOGLE_APPLICATION_CREDENTIALS)

Phase 2: Backend (route alternative)
├── 6. Créer src/app/api/ocr/vision/route.ts (nouvelle route)
├── 7. Ajouter parseVisionResponse() à ocr-service.ts
├── 8. Tests unitaires backend
└── 9. Tests d'intégration avec vraies images

Phase 3: Frontend (feature flag)
├── 10. Ajouter feature flag USE_VISION_API
├── 11. Créer fonction imageToBase64()
├── 12. Modifier handleFileChange() avec condition
├── 13. Tester en parallèle (Tesseract vs Vision)
└── 14. Comparer résultats et ajuster parsing

Phase 4: Migration complète
├── 15. Activer Vision API par défaut
├── 16. Supprimer code Tesseract
├── 17. Renommer route /api/ocr/vision → /api/ocr/parse
├── 18. npm uninstall tesseract.js
└── 19. Déployer et monitorer

Phase 5: Post-migration
├── 20. Vérifier bundle size
├── 21. Monitorer quotas API
└── 22. Documenter dans PROJECT_MEMORY.md
```

### 6.2 Fichiers à Créer

| # | Fichier | Description |
|---|---------|-------------|
| 1 | `src/lib/google-vision.ts` | Client Vision API singleton |
| 2 | `src/types/google-vision.d.ts` | Types TypeScript |
| 3 | `src/lib/__tests__/google-vision.test.ts` | Tests unitaires client |
| 4 | `src/app/api/ocr/vision/route.ts` | Route temporaire Vision |
| 5 | `src/services/__tests__/ocr-vision.test.ts` | Tests parser Vision |

### 6.3 Fichiers à Modifier

| # | Fichier | Modifications |
|---|---------|---------------|
| 1 | `package.json` | +`@google-cloud/vision`, -`tesseract.js` |
| 2 | `env.example` | +`GOOGLE_APPLICATION_CREDENTIALS` |
| 3 | `.gitignore` | +`*.json` credentials |
| 4 | `src/services/ocr-service.ts` | +`parseVisionResponse()` |
| 5 | `src/components/import/ocr-import-dialog.tsx` | Refonte complète |
| 6 | `src/app/api/ocr/parse/route.ts` | Remplacer Tesseract par Vision |
| 7 | `messages/fr.json` | +clés erreurs OCR |
| 8 | `messages/en.json` | +clés erreurs OCR |

### 6.4 Variables d'Environnement

```bash
# Ajout à .env et env.example

# ===========================================
# GOOGLE CLOUD VISION (pour OCR)
# ===========================================
# Option 1: Service Account JSON file path
# Générer depuis: GCP Console > IAM > Service Accounts > Create Key
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# Option 2: API Key (alternative plus simple)
# Générer depuis: GCP Console > APIs & Services > Credentials
# GOOGLE_VISION_API_KEY="AIza..."

# Quota monitoring (optionnel)
# GOOGLE_VISION_QUOTA_ALERT_EMAIL="admin@example.com"
```

---

## 7. Tests & Validation

### 7.1 Tests Unitaires

```typescript
// src/lib/__tests__/google-vision.test.ts

import { describe, it, expect, vi } from 'vitest';
import { visionClient } from '../google-vision';

describe('GoogleVisionClient', () => {
  it('should detect text from base64 image', async () => {
    // Mock the Vision API response
    const mockResponse = {
      fullTextAnnotation: {
        text: '12/30/2025 10:09:48 AM 25717.25 ...',
        pages: [/* ... */],
      },
    };
    
    vi.spyOn(visionClient, 'detectText').mockResolvedValue(mockResponse);
    
    const result = await visionClient.detectText('base64string...');
    
    expect(result.fullTextAnnotation).toBeDefined();
    expect(result.fullTextAnnotation?.text).toContain('12/30/2025');
  });

  it('should handle timeout gracefully', async () => {
    vi.spyOn(visionClient, 'detectText').mockRejectedValue(
      new Error('DEADLINE_EXCEEDED')
    );
    
    await expect(visionClient.detectText('...')).rejects.toThrow('DEADLINE');
  });

  it('should retry on server errors', async () => {
    const detectSpy = vi.spyOn(visionClient, 'detectText');
    
    // Fail first, succeed second
    detectSpy
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce({ fullTextAnnotation: { text: 'success' } });
    
    const result = await visionClient.detectText('...');
    
    expect(detectSpy).toHaveBeenCalledTimes(2);
    expect(result.fullTextAnnotation?.text).toBe('success');
  });
});
```

### 7.2 Tests d'Intégration

```typescript
// src/services/__tests__/ocr-vision.test.ts

import { describe, it, expect } from 'vitest';
import { parseVisionResponse } from '../ocr-service';
import { sampleVisionResponse } from './__fixtures__/vision-responses';

describe('parseVisionResponse', () => {
  it('should parse structured Vision response', () => {
    const result = parseVisionResponse(sampleVisionResponse, { symbol: 'MNQ' });
    
    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.trades[0]).toMatchObject({
      entryDt: expect.stringMatching(/\d{1,2}\/\d{1,2}\/\d{4}/),
      exitDt: expect.any(String),
      entryPrice: expect.any(Number),
      exitPrice: expect.any(Number),
      profitLoss: expect.any(Number),
    });
  });

  it('should filter low confidence blocks', () => {
    const lowConfidenceResponse = {
      fullTextAnnotation: {
        text: 'some text',
        pages: [{
          blocks: [{
            blockType: 'TEXT',
            confidence: 0.3, // Below threshold
            paragraphs: [{ words: [{ symbols: [{ text: 'x' }] }] }],
          }],
        }],
      },
    };
    
    const result = parseVisionResponse(lowConfidenceResponse);
    
    expect(result.warnings).toContain(expect.stringMatching(/ignoré/));
  });

  it('should fallback to text parsing when no structure', () => {
    const textOnlyResponse = {
      fullTextAnnotation: {
        text: '12/30/2025 10:09:48 AM 25717.25 25718.00 +50.00$',
        pages: [], // No structured data
      },
    };
    
    const result = parseVisionResponse(textOnlyResponse, { symbol: 'MNQ' });
    
    // Should still parse using the raw text
    expect(result.rawText).toContain('12/30/2025');
  });
});
```

### 7.3 Tests E2E (Manuel)

| # | Scénario | Image Test | Résultat Attendu |
|---|----------|------------|------------------|
| 1 | Screenshot NinjaTrader clair | `test-ninjatrader-light.png` | ≥90% trades détectés |
| 2 | Screenshot Tradovate sombre | `test-tradovate-dark.png` | ≥90% trades détectés |
| 3 | Image floue (basse résolution) | `test-blurry.png` | Warning qualité |
| 4 | Image sans texte trading | `test-random-image.png` | 0 trades, message info |
| 5 | Image très grande (15MB) | `test-large.png` | Erreur 413 |

### 7.4 Métriques de Validation

| Métrique | Seuil Minimum | Cible |
|----------|---------------|-------|
| Précision détection | 85% | 95% |
| Temps de traitement | <10s | <5s |
| Taux d'erreur API | <5% | <1% |
| Bundle size reduction | -5MB | -7MB |

---

## 8. Annexes

### Annexe A : Types Complets Google Vision

```typescript
// src/types/google-vision.d.ts

declare module '@google-cloud/vision' {
  export class ImageAnnotatorClient {
    constructor(options?: ClientOptions);
    annotateImage(request: AnnotateImageRequest): Promise<[AnnotateImageResponse]>;
  }

  interface ClientOptions {
    keyFilename?: string;
    credentials?: Credentials;
    projectId?: string;
  }

  interface Credentials {
    client_email: string;
    private_key: string;
  }

  interface AnnotateImageRequest {
    image: Image;
    features: Feature[];
  }

  interface Image {
    content?: string; // Base64
    source?: ImageSource;
  }

  interface ImageSource {
    imageUri?: string;
    gcsImageUri?: string;
  }

  interface Feature {
    type: 'DOCUMENT_TEXT_DETECTION' | 'TEXT_DETECTION' | 'LABEL_DETECTION';
    maxResults?: number;
  }

  interface AnnotateImageResponse {
    fullTextAnnotation?: TextAnnotation;
    textAnnotations?: EntityAnnotation[];
    error?: Status;
  }

  interface TextAnnotation {
    text: string;
    pages: Page[];
  }

  interface Page {
    property?: TextProperty;
    width: number;
    height: number;
    blocks: Block[];
    confidence: number;
  }

  interface Block {
    property?: TextProperty;
    boundingBox: BoundingPoly;
    paragraphs: Paragraph[];
    blockType: BlockType;
    confidence: number;
  }

  type BlockType = 'UNKNOWN' | 'TEXT' | 'TABLE' | 'PICTURE' | 'RULER' | 'BARCODE';

  interface Paragraph {
    property?: TextProperty;
    boundingBox: BoundingPoly;
    words: Word[];
    confidence: number;
  }

  interface Word {
    property?: TextProperty;
    boundingBox: BoundingPoly;
    symbols: Symbol[];
    confidence: number;
  }

  interface Symbol {
    property?: TextProperty;
    boundingBox: BoundingPoly;
    text: string;
    confidence: number;
  }

  interface TextProperty {
    detectedLanguages?: DetectedLanguage[];
    detectedBreak?: DetectedBreak;
  }

  interface DetectedLanguage {
    languageCode: string;
    confidence: number;
  }

  interface DetectedBreak {
    type: BreakType;
    isPrefix?: boolean;
  }

  type BreakType = 'UNKNOWN' | 'SPACE' | 'SURE_SPACE' | 'EOL_SURE_SPACE' | 'HYPHEN' | 'LINE_BREAK';

  interface BoundingPoly {
    vertices: Vertex[];
    normalizedVertices?: NormalizedVertex[];
  }

  interface Vertex {
    x: number;
    y: number;
  }

  interface NormalizedVertex {
    x: number;
    y: number;
  }

  interface EntityAnnotation {
    mid?: string;
    locale?: string;
    description: string;
    score?: number;
    confidence?: number;
    boundingPoly?: BoundingPoly;
  }

  interface Status {
    code: number;
    message: string;
    details?: any[];
  }
}
```

### Annexe B : Clés i18n à Ajouter

```json
// messages/fr.json (ajouts)
{
  "trades": {
    "ocrTimeout": "Le traitement de l'image a pris trop de temps. Veuillez réessayer.",
    "ocrQuotaExceeded": "Limite de requêtes atteinte. Veuillez réessayer plus tard.",
    "imageTooLarge": "L'image est trop grande (max 10MB).",
    "imageFormatInvalid": "Format d'image non supporté. Utilisez JPEG, PNG, WebP ou GIF.",
    "ocrLowQuality": "La qualité de l'image est faible. Les résultats peuvent être imprécis.",
    "ocrRetry": "Réessayer",
    "maxRetriesReached": "Nombre maximum de tentatives atteint.",
    "ocrAnalyzing": "Analyse en cours...",
    "ocrConverting": "Préparation de l'image..."
  }
}
```

```json
// messages/en.json (ajouts)
{
  "trades": {
    "ocrTimeout": "Image processing took too long. Please try again.",
    "ocrQuotaExceeded": "Request limit reached. Please try again later.",
    "imageTooLarge": "Image is too large (max 10MB).",
    "imageFormatInvalid": "Unsupported image format. Use JPEG, PNG, WebP or GIF.",
    "ocrLowQuality": "Image quality is low. Results may be inaccurate.",
    "ocrRetry": "Retry",
    "maxRetriesReached": "Maximum retry attempts reached.",
    "ocrAnalyzing": "Analyzing...",
    "ocrConverting": "Preparing image..."
  }
}
```

### Annexe C : Checklist de Déploiement

```markdown
## Pre-Deployment Checklist

### Configuration GCP
- [ ] Projet GCP créé
- [ ] Vision API activée
- [ ] Service Account créé avec rôle approprié
- [ ] Clé JSON générée
- [ ] Fichier JSON uploadé sur le serveur (hors repo)
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` configuré dans .env

### Code
- [ ] Tous les tests passent
- [ ] Build réussi sans erreurs
- [ ] Aucun `console.log` en production
- [ ] Types TypeScript validés

### Sécurité
- [ ] Clé JSON dans .gitignore
- [ ] Aucune clé hardcodée dans le code
- [ ] Rate limiting sur l'API route

### Monitoring
- [ ] Alertes quota configurées dans GCP
- [ ] Logging structuré activé
- [ ] Métriques de performance trackées

### Rollback Plan
- [ ] Branche stable identifiée
- [ ] Procédure de rollback documentée
- [ ] Feature flag disponible pour désactiver Vision API
```

---

## 📝 Changelog

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | 2026-01-08 | John (PM) | Création initiale |

---

**Document prêt pour validation.**  
Une fois approuvé, l'implémentation peut commencer par la Story 4.1.1 (Configuration GCP).
