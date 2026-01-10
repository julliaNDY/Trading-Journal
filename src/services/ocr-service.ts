/**
 * OCR Service - Parsing de captures d'écran de trading
 * 
 * Extrait les données de trades depuis du texte OCR.
 * Supporte Google Cloud Vision API (recommandé) et Tesseract (legacy).
 * Compatible avec les formats de plusieurs plateformes (NinjaTrader, Tradovate, etc.)
 */

import type { 
  VisionAnnotateImageResponse, 
  VisionParagraph, 
  VisionWord,
  ParsedLine,
  ImageQualityAnalysis,
} from '@/types/google-vision';

// ============================================================================
// TYPES
// ============================================================================

export interface PartialExitData {
  exitDt: string;
  exitPrice: number;
  quantity: number;
  pnl: number;
}

export interface OcrTradeData {
  entryDt: string;      // "12/30/2025 10:09:48 AM"
  exitDt: string;       // "12/30/2025 10:12:05 AM"
  entryPrice: number;
  exitPrice: number;    // Average exit price if multiple exits
  profitLoss: number;   // Total PnL
  quantity?: number;    // Total quantity
  partialExits?: PartialExitData[];  // Individual exits if multiple
  // Drawdown/Runup (MAE/MFE) - USD absolute values (always positive)
  drawdown?: number;    // Max Adverse Excursion - max unrealized loss during trade
  runup?: number;       // Max Favorable Excursion - max unrealized profit during trade
}

interface RawRow {
  entryDt: string;
  entryPrice: number;
  exitDt: string;
  exitPrice: number;
  quantity: number;
  pnl: number;
  isSubRow: boolean;
  lineNum: number;
  drawdown?: number;   // Max Adverse Excursion (USD, positive value)
  runup?: number;      // Max Favorable Excursion (USD, positive value)
}

export interface OcrParseResult {
  trades: OcrTradeData[];
  rawText: string;
  linesProcessed: number;
  warnings: string[];
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Prix min/max par type d'instrument
 * Permet de filtrer les faux positifs OCR
 */
export const PRICE_RANGES: Record<string, { min: number; max: number }> = {
  // Futures indices US
  NQ: { min: 10000, max: 50000 },   // Nasdaq 100 E-mini
  MNQ: { min: 10000, max: 50000 },  // Micro Nasdaq
  ES: { min: 2000, max: 10000 },    // S&P 500 E-mini
  MES: { min: 2000, max: 10000 },   // Micro S&P 500
  YM: { min: 20000, max: 60000 },   // Dow E-mini
  MYM: { min: 20000, max: 60000 },  // Micro Dow
  RTY: { min: 1000, max: 5000 },    // Russell 2000 E-mini
  
  // Crypto
  BTC: { min: 10000, max: 200000 },
  ETH: { min: 500, max: 20000 },
  
  // Forex (paires majeures - 4 décimales typiques)
  EURUSD: { min: 0.8, max: 1.5 },
  GBPUSD: { min: 1.0, max: 2.0 },
  
  // Default pour symboles inconnus (très large)
  DEFAULT: { min: 0.001, max: 1000000 },
};

/**
 * Obtient le range de prix valide pour un symbole
 */
export function getPriceRange(symbol?: string): { min: number; max: number } {
  if (!symbol) return PRICE_RANGES.DEFAULT;
  
  const upper = symbol.toUpperCase().trim();
  
  // Cherche le symbole exact d'abord
  if (PRICE_RANGES[upper]) return PRICE_RANGES[upper];
  
  // Cherche un préfixe correspondant (ex: "MNQ MAR25" -> "MNQ")
  for (const key of Object.keys(PRICE_RANGES)) {
    if (upper.startsWith(key)) return PRICE_RANGES[key];
  }
  
  return PRICE_RANGES.DEFAULT;
}

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Trouve tous les date/times dans une ligne
 * Formats supportés:
 * - MM/DD/YYYY HH:MM:SS AM/PM
 * - MM/DD/YYYY HH:MM:SS (24h)
 */
export function findDateTimes(line: string): string[] {
  const dateTimes: string[] = [];
  const seen = new Set<string>();
  
  const patterns = [
    // Avec espace entre date et time
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}:\d{2})\s*(AM|PM|A\.?M\.?|P\.?M\.?)?/gi,
    // Sans espace (OCR collé)
    /(\d{1,2}\/\d{1,2}\/\d{4})(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)?/gi,
  ];
  
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const date = match[1];
      const time = match[2];
      const ampm = match[3] ? match[3].replace(/\./g, '').toUpperCase() : '';
      const dt = `${date} ${time}${ampm ? ' ' + ampm : ''}`.trim();
      
      const key = `${date}-${time}`;
      if (!seen.has(key)) {
        seen.add(key);
        dateTimes.push(dt);
      }
    }
  }
  return dateTimes;
}

/**
 * Extrait les prix d'une ligne
 * Gère les erreurs OCR courantes (décimales manquantes, etc.)
 */
export function extractPrices(text: string, priceRange: { min: number; max: number }): number[] {
  const prices: number[] = [];
  const seen = new Set<number>();
  
  // Track les positions déjà matchées (évite les doublons decimal/whole)
  const matchedPositions = new Set<number>();
  
  // Pattern 1: Prix avec décimale (25717.25, 25773.5)
  const standardRegex = /\b(\d{3,6})[.,](\d{1,4})\b/g;
  let match;
  while ((match = standardRegex.exec(text)) !== null) {
    const price = parseFloat(match[1] + '.' + match[2]);
    if (price >= priceRange.min && price <= priceRange.max && !seen.has(price)) {
      seen.add(price);
      prices.push(price);
      // Marque toute la zone comme utilisée
      for (let i = match.index; i < match.index + match[0].length; i++) {
        matchedPositions.add(i);
      }
    }
  }
  
  // Pattern 2: Nombres entiers qui pourraient être des prix
  // Gère les erreurs OCR comme 257745 -> 25774.5
  // SEULEMENT si pas déjà matché par le pattern décimal
  const wholeRegex = /\b(\d{4,6})\b/g;
  while ((match = wholeRegex.exec(text)) !== null) {
    // Skip si cette position a déjà été matchée par un prix décimal
    if (matchedPositions.has(match.index)) continue;
    
    const numStr = match[1];
    let price: number;
    
    // Si 6 chiffres, probablement une décimale manquante
    if (numStr.length === 6) {
      // Essaie d'insérer la décimale avant le dernier chiffre
      price = parseFloat(numStr.slice(0, 5) + '.' + numStr.slice(5));
    } else if (numStr.length === 5 || numStr.length === 4) {
      price = parseFloat(numStr);
    } else {
      continue;
    }
    
    if (price >= priceRange.min && price <= priceRange.max && !seen.has(price)) {
      seen.add(price);
      prices.push(price);
    }
  }
  
  return prices;
}

/**
 * Extrait la quantité d'une ligne
 * Format typique: +1, -2, +3
 */
export function extractQuantity(text: string): number {
  const patterns = [
    /\s([+-]\d{1,3})\s/,       // Entouré d'espaces
    /([+-]\d{1,3})(?:\s|$)/,   // En fin de mot
    /^([+-]\d{1,3})\s/,        // En début de ligne
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return Math.abs(parseInt(match[1]));
    }
  }
  return 1; // Default à 1 contrat
}

/**
 * Extrait le PnL d'une ligne
 * Formats: -500,00$, +125.50$, 1234$, etc.
 */
export function extractPnL(text: string): number {
  const patterns = [
    // Format européen: -500,00 $
    /(-?\d+),(\d{2})\s*[$€§]/,
    // Format US: -500.00$
    /(-?\d+)\.(\d{2})\s*[$€§]/,
    // Collé au symbole
    /(-?\d+),(\d{2})[$€§]/,
    /(-?\d+)\.(\d{2})[$€§]/,
    // Sans centimes
    /(-?\d+)\s*[$€§]/,
    // PnL entre parenthèses (négatif)
    /\((\d+)[.,]?(\d{2})?\)\s*[$€§]?/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2]) {
        const value = parseFloat(match[1] + '.' + match[2]);
        // Gère le format (xxx) pour négatif
        if (text.includes('(') && !match[1].startsWith('-')) {
          return -Math.abs(value);
        }
        return value;
      }
      return parseFloat(match[1]);
    }
  }
  return 0;
}

/**
 * Extrait le Drawdown (MAE - Max Adverse Excursion) d'un texte
 * Formats supportés: 500.00$, 500,00 $, -500.00$, (500.00), 500
 * @returns Valeur absolue positive ou null si non trouvé
 */
export function extractDrawdown(text: string): number | null {
  return extractMoneyValue(text, 'drawdown');
}

/**
 * Extrait le Runup (MFE - Max Favorable Excursion) d'un texte  
 * Formats supportés: 500.00$, 500,00 $, -500.00$, (500.00), 500
 * @returns Valeur absolue positive ou null si non trouvé
 */
export function extractRunup(text: string): number | null {
  return extractMoneyValue(text, 'runup');
}

/**
 * Fonction interne pour extraire une valeur monétaire (DD ou RU)
 * Toujours retourne une valeur absolue positive
 */
function extractMoneyValue(text: string, type: 'drawdown' | 'runup'): number | null {
  const patterns = [
    // Format européen avec symbole: 500,00 $, 500,00$, 500,00 €
    /(-?\d+),(\d{2})\s*[$€§]/g,
    // Format US avec symbole: 500.00$, 500.00 $, -500.00$
    /(-?\d+)\.(\d{2})\s*[$€§]/g,
    // Format parenthèses (négatif): (500.00)$, (500,00) $
    /\((\d+)[.,](\d{2})\)\s*[$€§]?/g,
    // Sans centimes avec symbole: 500$, 500 $
    /(-?\d+)\s*[$€§]/g,
    // Nombre décimal sans symbole (utilisé quand contexte connu)
    /\b(\d+)[.,](\d{2})\b/g,
  ];

  // Pour Drawdown/Runup, on cherche généralement après le PnL dans la ligne
  // Les valeurs sont typiquement les dernières colonnes de données
  
  const allMatches: { value: number; position: number }[] = [];
  
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let value: number;
      if (match[2]) {
        // Format avec centimes
        value = parseFloat(match[1].replace('-', '') + '.' + match[2]);
      } else {
        // Format sans centimes
        value = Math.abs(parseFloat(match[1]));
      }
      
      // Filtre les valeurs hors plage raisonnable pour DD/RU (0-100000 USD)
      if (value > 0 && value < 100000) {
        allMatches.push({ value, position: match.index });
      }
    }
  }
  
  // Pour un contexte spécifique, on retourne null si aucune valeur trouvée
  // L'appel se fait depuis parseOcrText qui gère le positionnement
  if (allMatches.length === 0) return null;
  
  // Retourne la première valeur trouvée (sera affiné par le contexte d'appel)
  return allMatches[0].value;
}

/**
 * Extrait DD et RU d'une ligne en utilisant le positionnement relatif
 * Typiquement: ... PnL $ DD $ RU $
 * @returns { drawdown, runup } avec valeurs absolues positives ou undefined
 */
export function extractDrawdownRunup(line: string): { drawdown?: number; runup?: number } {
  const result: { drawdown?: number; runup?: number } = {};
  
  // Pattern pour trouver toutes les valeurs monétaires dans la ligne
  // On cherche les patterns: nombre,décimale $ ou nombre.décimale $
  const moneyPattern = /(-?\d+)[.,](\d{2})\s*[$€§]|\((\d+)[.,](\d{2})\)\s*[$€§]?/g;
  const matches: { value: number; position: number }[] = [];
  
  let match;
  while ((match = moneyPattern.exec(line)) !== null) {
    let value: number;
    if (match[3] && match[4]) {
      // Format parenthèses (500.00)
      value = parseFloat(match[3] + '.' + match[4]);
    } else if (match[1] && match[2]) {
      // Format standard
      value = Math.abs(parseFloat(match[1] + '.' + match[2]));
    } else {
      continue;
    }
    
    matches.push({ value, position: match.index });
  }
  
  // Les captures NinjaTrader/Tradovate ont généralement:
  // ... | PnL | Drawdown | Runup |
  // Donc les 2 dernières valeurs monétaires (après le PnL) sont DD et RU
  if (matches.length >= 3) {
    // Au moins 3 valeurs: PnL, DD, RU
    result.drawdown = matches[matches.length - 2].value;
    result.runup = matches[matches.length - 1].value;
  } else if (matches.length === 2) {
    // 2 valeurs: probablement juste PnL et une autre
    // On ne peut pas distinguer DD de RU, donc on ne remplit pas
  }
  
  return result;
}

/**
 * Vérifie si une ligne est un header à ignorer
 */
export function isHeaderLine(line: string): boolean {
  const lowerLine = line.toLowerCase();
  const headerKeywords = [
    'entry dt', 'entry price', 'exit dt', 'exit price',
    'profit loss', 'profit/loss', 'p/l',
    // Drawdown variants
    'drawdown', 'draw-down', 'draw down',
    // Runup variants  
    'runup', 'run-up', 'run up',
    // MAE/MFE (alternative names)
    'mae', 'mfe', 'max adverse', 'max favorable',
    // General
    'total', 'header', 'column',
    'qty', 'quantity', 'contracts',
  ];
  
  return headerKeywords.some(keyword => lowerLine.includes(keyword));
}

// ============================================================================
// COLUMN FORMAT DETECTION & PARSING (for Google Vision API)
// ============================================================================

/**
 * Détecte si le texte est au format colonne (Vision API)
 * Le format colonne a les caractéristiques suivantes:
 * - Beaucoup de lignes avec seulement 1 date/time
 * - Beaucoup de lignes avec seulement 1 prix
 * - Peu ou pas de lignes avec 2+ dates ET 2+ prix
 */
function detectColumnFormat(lines: string[], priceRange: { min: number; max: number }): boolean {
  let linesWithMultipleDates = 0;
  let linesWithSingleDate = 0;
  let linesWithSinglePrice = 0;

  for (const line of lines.slice(0, 50)) { // Check first 50 lines
    if (isHeaderLine(line)) continue;
    
    const dateTimes = findDateTimes(line);
    const prices = extractPrices(line, priceRange);
    
    if (dateTimes.length >= 2 && prices.length >= 2) {
      linesWithMultipleDates++;
    } else if (dateTimes.length === 1 && prices.length === 0) {
      linesWithSingleDate++;
    } else if (dateTimes.length === 0 && prices.length === 1) {
      linesWithSinglePrice++;
    }
  }

  // Si on a beaucoup de lignes avec seulement 1 date ou 1 prix,
  // et peu de lignes complètes, c'est le format colonne
  const totalSingleValues = linesWithSingleDate + linesWithSinglePrice;
  return totalSingleValues > 5 && linesWithMultipleDates < 3;
}

/**
 * Parse le texte au format colonne (Vision API)
 * Reconstruit les trades en collectant les colonnes séparément
 */
function parseColumnFormat(
  lines: string[], 
  priceRange: { min: number; max: number },
  rawText: string
): OcrParseResult {
  const warnings: string[] = [];
  const allDateTimes: string[] = [];
  const allPrices: number[] = [];
  const allPnLs: number[] = [];
  const allQuantities: number[] = [];

  // Collecte toutes les valeurs
  for (const line of lines) {
    if (isHeaderLine(line)) continue;

    const dateTimes = findDateTimes(line);
    const prices = extractPrices(line, priceRange);
    const pnl = extractPnL(line);
    const qty = extractQuantity(line);

    // Ajoute les dates trouvées
    for (const dt of dateTimes) {
      allDateTimes.push(dt);
    }

    // Ajoute les prix (si la ligne ne contient qu'un prix, pas une date)
    if (dateTimes.length === 0 && prices.length > 0) {
      for (const p of prices) {
        allPrices.push(p);
      }
    }

    // Ajoute les PnL (lignes avec $ ou €)
    if (pnl !== 0 && line.match(/[$€]/)) {
      allPnLs.push(pnl);
    }

    // Ajoute les quantités (lignes avec +/- suivi de chiffres)
    if (line.match(/^[+-]\d+$/) || line.match(/^\s*[+-]\d+\s*$/)) {
      allQuantities.push(qty);
    }
  }


  // Les dates sont en paires: Entry DT puis Exit DT alternés
  // OU toutes les Entry DT d'abord, puis toutes les Exit DT
  // On doit déterminer le pattern
  
  const trades: OcrTradeData[] = [];
  
  // Stratégie: assume que les dates sont groupées
  // D'abord N entry dates, puis N exit dates
  const numTrades = Math.floor(allDateTimes.length / 2);
  
  if (numTrades === 0) {
    warnings.push('No trades could be reconstructed from column format');
    return { trades: [], rawText, linesProcessed: lines.length, warnings };
  }

  // Essaie de déterminer si les dates sont alternées ou groupées
  // En regardant l'ordre chronologique des premières dates
  let entryDates: string[] = [];
  let exitDates: string[] = [];

  if (allDateTimes.length >= 2) {
    const date1 = parseOcrDateTime(allDateTimes[0]);
    const date2 = parseOcrDateTime(allDateTimes[1]);
    
    if (date1 && date2) {
      if (date2 > date1) {
        // Les dates sont probablement alternées (entry1, exit1, entry2, exit2...)
        // OU groupées (entry1, entry2, ..., exit1, exit2, ...)
        // Vérifions avec la 3ème date si disponible
        if (allDateTimes.length >= 3) {
          const date3 = parseOcrDateTime(allDateTimes[2]);
          if (date3 && date3 < date2) {
            // date3 < date2 suggère format groupé (toutes les entries d'abord)
            entryDates = allDateTimes.slice(0, numTrades);
            exitDates = allDateTimes.slice(numTrades, numTrades * 2);
          } else {
            // Format alterné
            for (let i = 0; i < allDateTimes.length; i += 2) {
              if (allDateTimes[i]) entryDates.push(allDateTimes[i]);
              if (allDateTimes[i + 1]) exitDates.push(allDateTimes[i + 1]);
            }
          }
        } else {
          // Seulement 2 dates, assume groupé
          entryDates = [allDateTimes[0]];
          exitDates = [allDateTimes[1]];
        }
      } else {
        // Première date > deuxième date - inhabituel, assume groupé
        entryDates = allDateTimes.slice(0, numTrades);
        exitDates = allDateTimes.slice(numTrades, numTrades * 2);
      }
    }
  }

  // Les prix sont aussi en paires: entry price puis exit price
  // Assume même pattern que les dates
  const entryPrices = allPrices.slice(0, numTrades);
  const exitPrices = allPrices.slice(numTrades, numTrades * 2);


  // Construit les trades
  for (let i = 0; i < numTrades; i++) {
    const entryDt = entryDates[i];
    const exitDt = exitDates[i];
    const entryPrice = entryPrices[i];
    const exitPrice = exitPrices[i];
    const pnl = allPnLs[i] ?? 0;

    if (!entryDt || !exitDt) {
      warnings.push(`Trade ${i + 1}: Missing entry or exit date`);
      continue;
    }

    if (!entryPrice || !exitPrice) {
      warnings.push(`Trade ${i + 1}: Missing entry or exit price`);
      continue;
    }

    trades.push({
      entryDt,
      exitDt,
      entryPrice,
      exitPrice,
      profitLoss: pnl,
      quantity: allQuantities[i] || 1,
    });
  }

  // Trie par date d'entrée
  trades.sort((a, b) => {
    const dateA = parseOcrDateTime(a.entryDt);
    const dateB = parseOcrDateTime(b.entryDt);
    return (dateA?.getTime() ?? 0) - (dateB?.getTime() ?? 0);
  });


  return {
    trades,
    rawText,
    linesProcessed: lines.length,
    warnings,
  };
}

// ============================================================================
// MAIN PARSING FUNCTION
// ============================================================================

/**
 * Parse le texte OCR et extrait les trades
 * Supporte deux formats:
 * 1. Format ligne (Tesseract): chaque trade sur une ligne
 * 2. Format colonne (Vision API): données organisées en colonnes verticales
 * 
 * @param text - Texte brut du résultat OCR
 * @param symbol - Symbole optionnel pour filtrer les ranges de prix
 * @returns OcrParseResult avec les trades et metadata
 */
export function parseOcrText(text: string, symbol?: string): OcrParseResult {
  const warnings: string[] = [];
  const priceRange = getPriceRange(symbol);
  
  // Normalise le texte
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ');

  // Split en lignes
  const lines = normalizedText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Détecte le format du texte
  // Si on trouve des lignes avec 2+ dates ET 2+ prix, c'est le format ligne
  // Sinon, c'est probablement le format colonne (Vision API)
  const isColumnFormat = detectColumnFormat(lines, priceRange);

  if (isColumnFormat) {
    return parseColumnFormat(lines, priceRange, text);
  }

  const rawRows: RawRow[] = [];

  // Track le dernier entry pour les sub-rows
  let lastEntryDt: string | null = null;
  let lastEntryPrice: number = 0;
  let lastEntryQty: number = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip headers
    if (isHeaderLine(line)) continue;

    const dateTimes = findDateTimes(line);
    const prices = extractPrices(line, priceRange);
    const pnl = extractPnL(line);
    const qty = extractQuantity(line);
    // Extract Drawdown/Runup (MAE/MFE) from line
    const { drawdown, runup } = extractDrawdownRunup(line);

    // CASE 1: Main row - 2 date/times (entry et exit)
    if (dateTimes.length >= 2) {
      if (prices.length >= 2) {
        // Cas normal: entry et exit price trouvés
        rawRows.push({
          entryDt: dateTimes[0],
          entryPrice: prices[0],
          exitDt: dateTimes[1],
          exitPrice: prices[1],
          quantity: qty,
          pnl,
          isSubRow: false,
          lineNum: i,
          drawdown,
          runup,
        });
        lastEntryDt = dateTimes[0];
        lastEntryPrice = prices[0];
        lastEntryQty = qty;
      } else if (prices.length === 1) {
        // Un seul prix trouvé - utilise comme placeholder
        rawRows.push({
          entryDt: dateTimes[0],
          entryPrice: prices[0],
          exitDt: dateTimes[1],
          exitPrice: prices[0], // Placeholder
          quantity: qty,
          pnl,
          isSubRow: false,
          lineNum: i,
          drawdown,
          runup,
        });
        lastEntryDt = dateTimes[0];
        lastEntryPrice = prices[0];
        lastEntryQty = qty;
        warnings.push(`Ligne ${i + 1}: Prix de sortie manquant, utilisé entry price`);
      } else {
        warnings.push(`Ligne ${i + 1}: 2 dates trouvées mais aucun prix`);
      }
    }
    // CASE 2: Sub-row - 1 seul date/time (exit d'un partial)
    else if (dateTimes.length === 1 && lastEntryDt && lastEntryPrice > 0) {
      if (prices.length >= 1) {
        rawRows.push({
          entryDt: lastEntryDt,
          entryPrice: lastEntryPrice,
          exitDt: dateTimes[0],
          exitPrice: prices[0],
          quantity: qty || lastEntryQty,
          pnl,
          isSubRow: true,
          lineNum: i,
          drawdown,
          runup,
        });
      }
    }
    // CASE 3: Pas de date mais un time seul (continuation)
    else if (dateTimes.length === 0 && lastEntryDt) {
      const timeOnly = line.match(/(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)?/i);
      if (timeOnly && prices.length >= 1) {
        const dateMatch = lastEntryDt.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (dateMatch) {
          const exitDt = `${dateMatch[1]} ${timeOnly[1]}${timeOnly[2] ? ' ' + timeOnly[2].toUpperCase() : ''}`;
          rawRows.push({
            entryDt: lastEntryDt,
            entryPrice: lastEntryPrice,
            exitDt,
            exitPrice: prices[0],
            quantity: qty || lastEntryQty,
            pnl,
            isSubRow: true,
            lineNum: i,
            drawdown,
            runup,
          });
        }
      }
    }
  }

  // Fix les main rows avec placeholder exit price
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row.isSubRow && row.entryPrice === row.exitPrice && row.pnl !== 0) {
      // Cherche un sub-row suivant pour récupérer le vrai exit price
      for (let j = i + 1; j < rawRows.length; j++) {
        const subRow = rawRows[j];
        if (subRow.entryDt === row.entryDt && subRow.isSubRow) {
          row.exitPrice = subRow.exitPrice;
          break;
        }
        if (!subRow.isSubRow) break;
      }
    }
  }


  // Consolide les trades (regroupe les sub-rows)
  const consolidatedTrades = consolidateRawRows(rawRows);

  // Trie par date d'entrée
  consolidatedTrades.sort((a, b) => {
    const dateA = parseOcrDateTime(a.entryDt);
    const dateB = parseOcrDateTime(b.entryDt);
    return (dateA?.getTime() ?? 0) - (dateB?.getTime() ?? 0);
  });

  return {
    trades: consolidatedTrades,
    rawText: text,
    linesProcessed: lines.length,
    warnings,
  };
}

/**
 * Consolide les raw rows en trades (regroupe les partial exits)
 */
function consolidateRawRows(rawRows: RawRow[]): OcrTradeData[] {
  const consolidatedTrades: OcrTradeData[] = [];
  const processedIndices = new Set<number>();

  for (let i = 0; i < rawRows.length; i++) {
    if (processedIndices.has(i)) continue;

    const mainRow = rawRows[i];
    processedIndices.add(i);
    
    const relatedRows = [mainRow];

    // Trouve les sub-rows liés (même entry)
    for (let j = i + 1; j < rawRows.length; j++) {
      if (processedIndices.has(j)) continue;
      
      const row = rawRows[j];
      
      if (row.entryDt === mainRow.entryDt && 
          Math.abs(row.entryPrice - mainRow.entryPrice) < 1) {
        relatedRows.push(row);
        processedIndices.add(j);
      } else if (!row.isSubRow) {
        break;
      }
    }

    if (relatedRows.length === 1) {
      // Trade simple (une seule sortie)
      const trade: OcrTradeData = {
        entryDt: mainRow.entryDt,
        exitDt: mainRow.exitDt,
        entryPrice: mainRow.entryPrice,
        exitPrice: mainRow.exitPrice,
        profitLoss: mainRow.pnl,
        quantity: mainRow.quantity,
      };
      // Add DD/RU if present
      if (mainRow.drawdown !== undefined) trade.drawdown = mainRow.drawdown;
      if (mainRow.runup !== undefined) trade.runup = mainRow.runup;
      consolidatedTrades.push(trade);
    } else {
      // Trade avec partial exits
      const partialExits: PartialExitData[] = relatedRows.map(row => ({
        exitDt: row.exitDt,
        exitPrice: row.exitPrice,
        quantity: row.quantity,
        pnl: row.pnl,
      }));

      const totalQuantity = partialExits.reduce((sum, e) => sum + e.quantity, 0);
      const totalPnl = partialExits.reduce((sum, e) => sum + e.pnl, 0);
      const weightedExitPrice = totalQuantity > 0 
        ? partialExits.reduce((sum, e) => sum + e.exitPrice * e.quantity, 0) / totalQuantity
        : partialExits[partialExits.length - 1].exitPrice;

      // Trouve le dernier exit time
      let lastExitDt = partialExits[0].exitDt;
      for (const pe of partialExits) {
        const peDate = parseOcrDateTime(pe.exitDt);
        const lastDate = parseOcrDateTime(lastExitDt);
        if (peDate && lastDate && peDate > lastDate) {
          lastExitDt = pe.exitDt;
        }
      }

      // For partial exits, use MAX DD/RU across all rows
      const maxDrawdown = Math.max(...relatedRows.map(r => r.drawdown ?? 0));
      const maxRunup = Math.max(...relatedRows.map(r => r.runup ?? 0));

      const trade: OcrTradeData = {
        entryDt: mainRow.entryDt,
        exitDt: lastExitDt,
        entryPrice: mainRow.entryPrice,
        exitPrice: Math.round(weightedExitPrice * 100) / 100,
        profitLoss: totalPnl,
        quantity: totalQuantity,
        partialExits,
      };
      // Add DD/RU if any row had values
      if (maxDrawdown > 0) trade.drawdown = maxDrawdown;
      if (maxRunup > 0) trade.runup = maxRunup;
      consolidatedTrades.push(trade);
    }
  }

  return consolidatedTrades;
}

/**
 * Parse une date/time au format OCR: "12/30/2025 10:09:48 AM"
 */
export function parseOcrDateTime(dateStr: string): Date | null {
  try {
    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*([AP]M?)?/i);
    if (!match) return null;
    
    const [, month, day, year, hours, minutes, seconds, ampm] = match;
    let hour = parseInt(hours);
    
    // Gère AM/PM
    if (ampm) {
      const ampmUpper = ampm.toUpperCase();
      if ((ampmUpper === 'PM' || ampmUpper === 'P') && hour !== 12) hour += 12;
      if ((ampmUpper === 'AM' || ampmUpper === 'A') && hour === 12) hour = 0;
    }
    
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      hour,
      parseInt(minutes),
      parseInt(seconds)
    );
  } catch {
    return null;
  }
}

// ============================================================================
// GOOGLE VISION API PARSING
// ============================================================================

const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

export interface VisionParseOptions {
  /** Seuil de confiance minimum pour inclure un bloc (0-1) */
  confidenceThreshold?: number;
  /** Symbole pour filtrer les ranges de prix */
  symbol?: string;
}

export interface VisionParseResult extends OcrParseResult {
  /** Analyse de la qualité de l'image */
  qualityAnalysis?: ImageQualityAnalysis;
}

/**
 * Parse la réponse de Google Cloud Vision API
 * 
 * Exploite la structure hiérarchique (blocks → paragraphs → words → symbols)
 * et les scores de confiance pour un parsing plus précis.
 * 
 * @param response - Réponse de l'API Vision
 * @param options - Options de parsing
 * @returns Résultat du parsing avec trades et métadonnées
 */
export function parseVisionResponse(
  response: VisionAnnotateImageResponse,
  options: VisionParseOptions = {}
): VisionParseResult {
  const { 
    confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
    symbol 
  } = options;

  const fullText = response.fullTextAnnotation;
  
  // Si pas de structure, fallback sur le texte brut
  if (!fullText?.pages?.length) {
    const rawText = fullText?.text || '';
    return {
      ...parseOcrText(rawText, symbol),
      qualityAnalysis: {
        quality: rawText ? 'medium' : 'poor',
        avgConfidence: rawText ? 0.5 : 0,
        totalBlocks: 0,
        lowConfidenceBlocks: 0,
        recommendation: rawText 
          ? 'No structured data available, using raw text parsing.'
          : 'No text detected in image.',
      },
    };
  }

  const warnings: string[] = [];
  const lines: ParsedLine[] = [];
  let lowConfidenceCount = 0;
  let totalBlocks = 0;
  const confidences: number[] = [];

  // Extraire les lignes depuis la structure Vision
  for (const page of fullText.pages) {
    for (const block of page.blocks || []) {
      // Skip blocs non-texte
      if (block.blockType !== 'TEXT') continue;
      
      totalBlocks++;
      const blockConfidence = block.confidence ?? 1;
      confidences.push(blockConfidence);
      
      if (blockConfidence < confidenceThreshold) {
        lowConfidenceCount++;
        continue;
      }

      for (const paragraph of block.paragraphs || []) {
        const paraConfidence = paragraph.confidence ?? blockConfidence;
        
        if (paraConfidence < confidenceThreshold) {
          continue;
        }

        const { text: lineText, words } = extractParagraphContent(paragraph);
        
        if (lineText.trim()) {
          lines.push({
            text: lineText,
            confidence: paraConfidence,
            words,
            lineIndex: lines.length,
          });
        }
      }
    }
  }

  if (lowConfidenceCount > 0) {
    warnings.push(
      `${lowConfidenceCount} bloc(s) ignoré(s) (confiance < ${Math.round(confidenceThreshold * 100)}%)`
    );
  }

  // Calculer la qualité moyenne
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  const qualityAnalysis: ImageQualityAnalysis = {
    quality: avgConfidence >= 0.85 ? 'good' : avgConfidence >= 0.7 ? 'medium' : 'poor',
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    totalBlocks,
    lowConfidenceBlocks: lowConfidenceCount,
    recommendation: avgConfidence < 0.7 
      ? 'Image quality is low. Consider using a higher resolution screenshot.'
      : undefined,
  };

  // Reconstituer le texte pour le parsing
  const reconstructedText = lines.map(l => l.text).join('\n');
  
  // Parser avec le texte reconstitué
  const result = parseOcrText(reconstructedText, symbol);

  return {
    ...result,
    rawText: fullText.text || reconstructedText,
    warnings: [...result.warnings, ...warnings],
    qualityAnalysis,
  };
}

/**
 * Extrait le contenu d'un paragraphe Vision en texte + mots structurés
 */
function extractParagraphContent(paragraph: VisionParagraph): { 
  text: string; 
  words: ParsedLine['words'];
} {
  const words: ParsedLine['words'] = [];
  const textParts: string[] = [];

  for (const word of paragraph.words || []) {
    const wordText = getWordText(word);
    const wordConfidence = word.confidence ?? 1;
    
    words.push({
      text: wordText,
      confidence: wordConfidence,
      bounds: word.boundingBox,
    });

    textParts.push(wordText);
    
    // Ajouter espace/newline selon le break type du dernier symbole
    const lastSymbol = word.symbols?.[word.symbols.length - 1];
    const breakType = lastSymbol?.property?.detectedBreak?.type;
    
    if (breakType === 'EOL_SURE_SPACE' || breakType === 'LINE_BREAK') {
      textParts.push('\n');
    } else if (breakType === 'SPACE' || breakType === 'SURE_SPACE') {
      textParts.push(' ');
    } else {
      // Ajouter un espace par défaut entre les mots
      textParts.push(' ');
    }
  }

  return {
    text: textParts.join('').trim(),
    words,
  };
}

/**
 * Extrait le texte d'un mot Vision (concatène les symboles)
 */
function getWordText(word: VisionWord): string {
  return (word.symbols || [])
    .map(s => s.text || '')
    .join('');
}

/**
 * Vérifie si les credentials Google Vision sont configurés
 */
export function isVisionApiConfigured(): boolean {
  return !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || 
    process.env.GOOGLE_VISION_API_KEY
  );
}

