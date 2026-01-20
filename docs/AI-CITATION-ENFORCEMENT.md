# AI Citation Enforcement - Developer Guide

**Version**: 1.0  
**Last Updated**: 2026-01-20  
**Story**: 12.10 - Anti-Hallucination System

---

## 📖 Quick Start

### **1. Import the Tools**

```typescript
import { createSecurityTracker } from '@/services/ai/data-source-tracker';
import { validateAIResponse, extractJSON, generateRetryPrompt, shouldRetry } from '@/services/ai/response-validator';
```

### **2. Track Data Sources**

```typescript
// Create tracker for your analysis step
const tracker = createSecurityTracker('NQ1');

// Track all data sources you access
tracker.addAPI('TradingView API - Market data');
tracker.addCalculation('Volatility Index - Calculated from 24h price range');
tracker.addDatabase('PostgreSQL - Historical prices');

// Get allowed sources for validation
const allowedSources = tracker.getSources();
```

### **3. Validate AI Response**

```typescript
// Get AI response
const aiResponse = await callAI(prompt);

// Validate for hallucination
const validation = validateAIResponse(
  aiResponse,
  allowedSources,
  { strictMode: false, maxErrors: 3 }
);

// Check results
if (!validation.valid) {
  console.error('Hallucination detected:', validation.errors);
  // Retry or handle error
}
```

### **4. Implement Retry Logic**

```typescript
let attempt = 0;
const maxRetries = 2;
let prompt = buildPrompt(data);

while (attempt < maxRetries) {
  attempt++;
  
  // Call AI
  const response = await callAI(prompt);
  
  // Extract JSON
  const cleanedJSON = extractJSON(response);
  
  // Parse
  const parsed = JSON.parse(cleanedJSON);
  
  // Validate
  const validation = validateAIResponse(cleanedJSON, allowedSources);
  
  // Check if should retry
  if (shouldRetry(validation, attempt, maxRetries)) {
    // Generate stronger prompt
    prompt = generateRetryPrompt(prompt, validation.errors);
    continue;
  }
  
  // Success or max retries reached
  break;
}
```

---

## 🎯 Why This System Exists

### **Problem: AI Hallucination**

AI models sometimes invent facts, URLs, or data sources that don't exist:

**❌ Bad Example:**
```json
{
  "reasoning": "According to Bloomberg Terminal API at https://bloomberg.com/api/v2/data, volatility is 65%"
}
```

**Problems:**
- URL doesn't exist
- Bloomberg API not accessed
- Data fabricated

### **Solution: Citation Enforcement**

Our system:
1. **Tracks** all real data sources accessed
2. **Validates** AI responses against allowed sources
3. **Detects** hallucination patterns (URLs, fake APIs, etc.)
4. **Retries** with stronger anti-hallucination prompts
5. **Logs** validation results for monitoring

**✅ Good Example:**
```json
{
  "reasoning": "Based on the provided market data (24h price range: 5.2%), volatility index calculated at 65"
}
```

---

## 🛠️ API Reference

### **DataSourceTracker**

#### **Constructor**

```typescript
const tracker = new DataSourceTracker(analysisStep: string, instrument: string);
```

#### **Methods**

| Method | Description | Example |
|--------|-------------|---------|
| `addAPI(name, metadata?)` | Track API call | `tracker.addAPI('TradingView API')` |
| `addDatabase(name, metadata?)` | Track database query | `tracker.addDatabase('PostgreSQL - Prices')` |
| `addCalculation(name, metadata?)` | Track derived metric | `tracker.addCalculation('Volatility - Calculated')` |
| `addExternal(name, metadata?)` | Track external source | `tracker.addExternal('ForexFactory Events')` |
| `getSources()` | Get array of source names | `tracker.getSources()` |
| `getDetailedSources()` | Get full DataSource objects | `tracker.getDetailedSources()` |
| `getSummary()` | Get summary with counts | `tracker.getSummary()` |
| `hasSource(name)` | Check if source exists | `tracker.hasSource('TradingView')` |
| `getSourcesByType(type)` | Filter by type | `tracker.getSourcesByType('api')` |
| `clear()` | Remove all sources | `tracker.clear()` |
| `toJSON()` | Export for storage | `tracker.toJSON()` |

#### **Factory Functions**

```typescript
createSecurityTracker(instrument: string)
createMacroTracker(instrument: string)
createFluxTracker(instrument: string)
createMag7Tracker(instrument: string)
createTechnicalTracker(instrument: string)
```

---

### **Response Validator**

#### **validateAIResponse**

```typescript
validateAIResponse(
  response: string,
  allowedSources: string[],
  options?: {
    strictMode?: boolean;  // Warnings become errors (default: false)
    maxErrors?: number;     // Max errors before failing (default: 3)
  }
): ValidationResult
```

**Returns:**
```typescript
{
  valid: boolean;           // Overall validity
  errors: string[];         // Critical errors (hallucinations)
  warnings: string[];       // Minor issues
  confidence: number;       // Quality score (0-1)
}
```

#### **validateCitations**

```typescript
validateCitations(
  response: string,
  allowedSources: string[]
): {
  valid: boolean;
  errors: string[];
  citedSources: string[];
}
```

#### **extractJSON**

```typescript
extractJSON(response: string): string
```

Removes markdown code blocks and extracts JSON object.

#### **generateRetryPrompt**

```typescript
generateRetryPrompt(
  originalPrompt: string,
  validationErrors: string[]
): string
```

Generates enhanced prompt with anti-hallucination warnings.

#### **shouldRetry**

```typescript
shouldRetry(
  validation: ValidationResult,
  attempt: number,
  maxRetries: number = 2
): boolean
```

Determines if retry is worthwhile.

---

## 🚨 Hallucination Patterns Detected

### **1. Invented URLs**

```
Pattern: /https?:\/\/[^\s"']+/gi
Severity: ERROR
Example: "According to https://fake-api.com/data..."
```

### **2. Fake API References**

```
Pattern: /according to (?!the data provided)[A-Z][a-zA-Z\s]+ API/gi
Severity: ERROR
Example: "According to Bloomberg Terminal API..."
```

### **3. Unverified Data Claims**

```
Pattern: /(?:source|data from) [A-Z][a-zA-Z\s]+ (?:shows|indicates)/gi
Severity: ERROR
Example: "Data from Reuters shows volatility..."
```

### **4. Implied Data Retrieval**

```
Pattern: /retrieved from|fetched from|pulled from/gi
Severity: WARNING
Example: "Data retrieved from external source..."
```

### **5. Invented Websites**

```
Pattern: /www\.[^\s"']+/gi
Severity: ERROR
Example: "Visit www.fake-data-source.com for more..."
```

### **6. News Source Citations**

```
Pattern: /(?:Bloomberg|Reuters|CNBC) (?:reported|stated)/gi
Severity: WARNING
Example: "Bloomberg reported that volatility..."
```

### **7. Recent Data References**

```
Pattern: /based on (?:recent|latest) (?:news|reports|data)/gi
Severity: WARNING
Example: "Based on recent news reports..."
```

### **8. Overly Confident Predictions**

```
Pattern: /\b(?:obviously|clearly|definitely) [a-z]+ (?:will|should|must)/gi
Severity: WARNING
Example: "Obviously the price will increase..."
```

---

## 🎨 Best Practices

### **1. Always Track Data Sources**

```typescript
// ❌ BAD: No tracking
const result = await analyzeData(instrument);

// ✅ GOOD: Track all sources
const tracker = createSecurityTracker(instrument);
tracker.addAPI('TradingView - Market data');
tracker.addCalculation('Volatility - Calculated from 24h range');
const result = await analyzeDataWithTracking(instrument, tracker);
```

### **2. Validate Before Using AI Response**

```typescript
// ❌ BAD: Use response without validation
const aiResponse = await callAI(prompt);
return JSON.parse(aiResponse);

// ✅ GOOD: Validate first
const aiResponse = await callAI(prompt);
const validation = validateAIResponse(aiResponse, allowedSources);
if (!validation.valid) {
  throw new Error(`Hallucination detected: ${validation.errors.join(', ')}`);
}
return JSON.parse(extractJSON(aiResponse));
```

### **3. Implement Retry Logic**

```typescript
// ❌ BAD: Single attempt
const response = await callAI(prompt);

// ✅ GOOD: Retry on validation failure
let attempt = 0;
while (attempt < 2) {
  attempt++;
  const response = await callAI(prompt);
  const validation = validateAIResponse(response, allowedSources);
  
  if (!shouldRetry(validation, attempt, 2)) {
    return response;
  }
  
  prompt = generateRetryPrompt(prompt, validation.errors);
}
```

### **4. Log Validation Results**

```typescript
// ❌ BAD: Silent failures
validateAIResponse(response, sources);

// ✅ GOOD: Log for monitoring
const validation = validateAIResponse(response, sources);
logger.info('AI validation', {
  valid: validation.valid,
  errors: validation.errors.length,
  warnings: validation.warnings.length,
  confidence: validation.confidence
});
```

### **5. Update Prompts with Anti-Hallucination Rules**

```typescript
// ❌ BAD: Generic prompt
const prompt = `Analyze ${instrument}...`;

// ✅ GOOD: Include anti-hallucination instructions
const prompt = `
CRITICAL: ONLY use data provided below. DO NOT invent sources.

DATA PROVIDED:
${JSON.stringify(marketData)}

Analyze ${instrument}...
`;
```

---

## 🧪 Testing

### **Unit Tests**

```bash
# Run all validation tests
npm test response-validator.test.ts

# Run data source tracker tests
npm test data-source-tracker.test.ts

# Watch mode
npm test -- --watch
```

### **Manual Testing**

```typescript
import { validateAIResponse } from '@/services/ai/response-validator';

// Test 1: Valid response
const validResponse = '{"reasoning": "Based on provided data, volatility is 65%"}';
const result1 = validateAIResponse(validResponse, ['provided data']);
console.assert(result1.valid === true);

// Test 2: Hallucinated URL
const badResponse = '{"reasoning": "According to https://fake-api.com, volatility is 65%"}';
const result2 = validateAIResponse(badResponse, ['provided data']);
console.assert(result2.valid === false);
console.assert(result2.errors.some(e => e.includes('URL')));
```

---

## 📊 Monitoring

### **Key Metrics to Track**

1. **Validation Rate**: % of responses that pass validation
2. **Retry Rate**: % of requests requiring retries
3. **Error Types**: Distribution of hallucination patterns
4. **Confidence Scores**: Average confidence after validation
5. **Latency Impact**: Additional time for validation

### **Example Monitoring Code**

```typescript
const metrics = {
  total: 0,
  valid: 0,
  retries: 0,
  errors: {} as Record<string, number>
};

// After each validation
metrics.total++;
if (validation.valid) metrics.valid++;
if (attempt > 1) metrics.retries++;

validation.errors.forEach(error => {
  const key = error.split(':')[0]; // Extract error type
  metrics.errors[key] = (metrics.errors[key] || 0) + 1;
});

// Log metrics
logger.info('AI validation metrics', {
  validationRate: (metrics.valid / metrics.total * 100).toFixed(2) + '%',
  retryRate: (metrics.retries / metrics.total * 100).toFixed(2) + '%',
  topErrors: Object.entries(metrics.errors)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
});
```

---

## 🔧 Configuration

### **Customize Hallucination Patterns**

Edit `src/services/ai/response-validator.ts`:

```typescript
export const HALLUCINATION_PATTERNS: HallucinationCheck[] = [
  // Add custom pattern
  {
    pattern: /your custom regex/gi,
    severity: 'error' | 'warning',
    message: 'Description of what this detects'
  },
  // ... existing patterns
];
```

### **Adjust Retry Behavior**

```typescript
// In your service file
const maxRetries = 3;           // Increase retries
const strictMode = true;        // Warnings become errors
const maxErrors = 5;            // Allow more errors before failing
```

### **Add Allowed Source Keywords**

Edit `src/services/ai/response-validator.ts`:

```typescript
const ALLOWED_SOURCE_KEYWORDS = [
  'provided data',
  'data provided',
  'your custom keyword',
  // ... more keywords
];
```

---

## ❓ FAQ

### **Q: Will this slow down my AI responses?**

A: Minimal impact (~100-500ms for validation). Retries add more latency but are rare (<5%).

### **Q: What happens if validation fails after max retries?**

A: You can either throw an error or return a fallback response. Log the failure for investigation.

### **Q: Can I disable validation for specific cases?**

A: Yes, simply skip calling `validateAIResponse`. But not recommended for production.

### **Q: How do I add a new analysis step?**

A: Create a factory function in `data-source-tracker.ts`:
```typescript
export function createMyAnalysisTracker(instrument: string): DataSourceTracker {
  return new DataSourceTracker('my-analysis', instrument);
}
```

### **Q: What if AI cites a legitimate external source?**

A: Add it to `allowedSources` array when creating the tracker:
```typescript
const allowedSources = [
  ...tracker.getSources(),
  'Specific External Source Name'
];
```

---

## 📚 Additional Resources

- **Story**: `docs/stories/12.10.story.md`
- **Implementation Summary**: `docs/stories/12.10-IMPLEMENTATION-SUMMARY.md`
- **Source Code**:
  - `src/services/ai/data-source-tracker.ts`
  - `src/services/ai/response-validator.ts`
- **Tests**:
  - `src/services/ai/__tests__/response-validator.test.ts`
  - `src/services/ai/__tests__/data-source-tracker.test.ts`

---

**Need Help?** Check the implementation summary or tests for working examples.

**Found a Bug?** Update hallucination patterns or validation logic accordingly.

**End of Developer Guide**
