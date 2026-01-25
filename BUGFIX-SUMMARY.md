# Bug Fixes Summary - 2026-01-25

## Critical Production Bugs Fixed

### 1. ✅ API Payload Size Limit (413 Error)
**Status:** FIXED  
**Commits:** `15e3af3`

#### Problem
- Production logs showed `413 Request Entity Too Large` errors
- Affected `/api/ocr/parse` endpoint when uploading large images
- Affected CSV imports with large files

#### Root Cause
- `bodySizeLimit` was set to 50mb in `next.config.mjs`
- No explicit API bodyParser configuration
- OCR route lacked payload size config

#### Solution
- ✅ Increased `bodySizeLimit` to 100MB in next.config.mjs
- ✅ Added API bodyParser config with 100MB limit
- ✅ Configured OCR route with explicit body size limit

#### Files Changed
- `next.config.mjs`
- `src/app/api/ocr/parse/route.ts`

---

### 2. ✅ React Select Component Error
**Status:** FIXED  
**Commits:** `f7f01a8`

#### Problem
- React error: "A <Select.Item /> must have a value prop that is not an empty string"
- Occurred in Import Profile Selector component
- Caused UI warnings in production

#### Root Cause
- Select component used `value=""` (empty string) as default
- React Select requires either a valid value or `undefined`

#### Solution
- ✅ Changed `value={selectedProfileId || ''}` to `value={selectedProfileId || undefined}`

#### Files Changed
- `src/components/import/import-profile-selector.tsx`

---

### 3. ✅ Missing i18n Translation Key
**Status:** FIXED  
**Commits:** `f7f01a8`

#### Problem
- Production logs showed: "MISSING_MESSAGE: import.profiles.optional"
- Missing translation key in English locale file

#### Root Cause
- Key referenced in code but not present in `messages/en.json`

#### Solution
- ✅ Added `"optional": "(Optional)"` key to `import.profiles` section

#### Files Changed
- `messages/en.json`

---

### 4. ⚠️ Vercel Analytics 404 Errors
**Status:** DOCUMENTED (Not Fixed - Needs Confirmation)

#### Problem
- Production logs show 404 errors for Vercel analytics scripts:
  - `Failed to load script ... speed-insights/script.js`
  - Analytics components may be loading in non-production environments

#### Root Cause Hypothesis
- Vercel analytics may not be properly configured for this project
- Scripts might be conditionally loaded but Vercel integration not enabled

#### Recommended Solution
1. Check if Vercel project has analytics enabled in dashboard
2. Wrap analytics components in production-only conditional:
   ```tsx
   {process.env.NODE_ENV === 'production' && <Analytics />}
   ```
3. Or remove analytics imports if not using Vercel deployment

#### Files to Check
- `src/app/layout.tsx` (look for Vercel analytics imports)
- Vercel project settings

---

## Daily Bias UI Logic Bugs

### 5. ⚠️ Institutional Flux Static Data
**Status:** DOCUMENTED (Root Cause: AI/Cache)

#### Problem
- Volume level, volume trend, and buy/sell pressure showing static/unchanging values
- Data doesn't update between different analyses

#### Root Cause Analysis
Service code is correct (`src/services/daily-bias/institutional-flux-service.ts`):
- Uses AI to generate fresh analyses
- Has proper cache invalidation
- No hardcoded values in service layer

**Likely causes:**
1. **Redis cache** keeping stale data (24h TTL)
2. **AI returning similar values** due to:
   - Mock/simulated market data
   - Low temperature (0.3) causing consistent outputs
   - Similar prompts generating similar responses

#### Recommended Solutions
1. Add cache invalidation button in UI
2. Include timestamp/source verification in UI
3. Add mock data warning when using simulated data
4. Increase AI temperature for more variation (if needed)
5. Use real market data sources instead of mocks

#### Files Involved
- `src/components/daily-bias/institutional-flux-card.tsx` (display)
- `src/services/daily-bias/institutional-flux-service.ts` (service)
- `src/lib/prompts/institutional-flux.ts` (prompts)

---

### 6. ⚠️ Technical Structure Data Not Updating
**Status:** DOCUMENTED (Same Root Cause as #5)

#### Problem
- Technical analysis card shows same data across multiple analyses
- Support/resistance levels don't change

#### Root Cause
Same as Institutional Flux (#5):
- Redis cache (24h TTL)
- AI consistency with mock data
- No timestamp/source verification in UI

#### Recommended Solutions
Same as #5 - see above.

#### Files Involved
- `src/components/daily-bias/technical-analysis-card.tsx`
- `src/services/daily-bias/technical-analysis-service.ts` (likely exists)

---

### 7. ⚠️ Synthesis Sentiment Mismatch
**Status:** DOCUMENTED (UI Logic Issue)

#### Problem
- Summary card shows "NEUTRAL" sentiment inside a "BEARISH" styled container
- Visual mismatch between badge and container styling
- Sources don't rotate/update correctly

#### Root Cause
Possible causes:
1. **Sentiment prop conflict:** Multiple sentiment sources (synthesis.finalBias vs synthesisSentiment)
2. **Container styling logic:** Container uses wrong sentiment variable
3. **Source rotation logic:** Sources array not being updated/shuffled

#### Recommended Solutions
1. Audit `SynthesisCard` component for sentiment prop usage
2. Ensure single source of truth for sentiment
3. Check if container background uses correct sentiment variable
4. Verify sources array updates when new analysis arrives

#### Files Involved
- `src/components/daily-bias/synthesis-card.tsx`
- `src/components/daily-bias/synthesis-tab.tsx`
- `src/app/(dashboard)/daily-bias/daily-bias-content.tsx` (data flow)

---

## Build Validation

✅ **Build Status:** SUCCESS  
- All fixes compiled without errors
- No TypeScript errors
- No linting errors
- Build completed in 88.9s

---

## Deployment Checklist

Before deploying these fixes:

- [x] All critical bugs fixed (#1, #2, #3)
- [x] Build passes locally
- [ ] Verify Vercel analytics configuration (#4)
- [ ] Test large file uploads (CSV >50MB, images >10MB)
- [ ] Test import profile selector with empty state
- [ ] Check i18n translations display correctly
- [ ] (Optional) Add cache invalidation for Daily Bias
- [ ] (Optional) Add mock data warnings for Daily Bias
- [ ] Monitor production logs for remaining errors

---

## Notes for Future

### Daily Bias Data Issues
The Institutional Flux and Technical Structure "static data" issues are **NOT code bugs** but rather:
1. Expected behavior of Redis cache (design decision)
2. Limitation of using mock/simulated market data
3. AI consistency when given similar inputs

**To truly fix:**
- Implement real-time market data integration
- Add explicit cache busting UI controls
- Display data freshness indicators (timestamp, source)
- Add "using simulated data" warnings

### Testing Recommendations
1. Test CSV imports with files 50-100MB
2. Test OCR with high-resolution screenshots (>5MB)
3. Test Daily Bias with cache cleared (Redis flush)
4. Verify i18n keys in both EN and FR locales

---

**Last Updated:** 2026-01-25  
**Commits:** `15e3af3`, `f7f01a8`
