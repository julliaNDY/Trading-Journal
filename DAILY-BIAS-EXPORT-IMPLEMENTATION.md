# Daily Bias - Data Sources & Export Implementation

## Implementation Date
January 20, 2026

## Overview
Implemented two key features for the Daily Bias analysis page:
1. Display of data sources in analysis cards
2. Export analysis functionality to PNG image

## Changes Made

### 1. Type Updates (`src/types/daily-bias.ts`)

Added optional `dataSources` field to the following interfaces:
- `SecurityAnalysis`
- `InstitutionalFlux`  
- `Mag7Analysis`
- `TechnicalStructure` (with alias `TechnicalAnalysis`)

Also extended `InstitutionalFlux` interface to include:
- `volumeProfile.totalVolume`
- `orderFlow.netFlow`
- `orderFlow.buyPressure`
- `orderFlow.sellPressure`
- `orderFlow.confirmation`

### 2. Card Components - Data Sources Display

Updated the following card components to display data sources in the header description:

#### Files Modified:
- `src/components/daily-bias/security-analysis-card.tsx`
- `src/components/daily-bias/institutional-flux-card.tsx`
- `src/components/daily-bias/mag7-analysis-card.tsx`
- `src/components/daily-bias/technical-analysis-card.tsx`

#### Implementation:
```tsx
<CardDescription className="space-y-1">
  <div>{analysis.instrument} • {new Date(analysis.timestamp).toLocaleString()}</div>
  {analysis.dataSources && analysis.dataSources.length > 0 && (
    <div className="text-xs text-muted-foreground">
      <strong>Sources:</strong> {analysis.dataSources.join(', ')}
    </div>
  )}
</CardDescription>
```

The data sources will display dynamically when provided by the AI analysis service.
Example: "Sources: Bloomberg, TradingView, FRED Economic Data"

### 3. Export Analysis Button (`src/app/(dashboard)/daily-bias/daily-bias-content.tsx`)

#### Dependencies Added:
```bash
npm install html2canvas --legacy-peer-deps
```

#### Implementation Details:

**Imports Added:**
- `useRef` from React
- `Download` icon from lucide-react
- `html2canvas` library

**State Added:**
```typescript
const [exporting, setExporting] = useState(false);
const analysisContainerRef = useRef<HTMLDivElement>(null);
```

**Export Handler:**
```typescript
const handleExportAnalysis = async () => {
  // Captures the analysis container as a canvas
  // Converts to PNG blob
  // Downloads automatically with filename: daily-bias-{instrument}-{date}.png
  // Shows toast notification on success/failure
}
```

**UI Changes:**
1. Wrapped the entire analysis results section in a ref container
2. Added "Export Analysis" button below the results:
   - Centered horizontally
   - Large size with outline variant
   - Shows loading state with spinner during export
   - Download icon when ready

#### Export Configuration:
- Background color: `#09090b` (dark theme)
- Scale: `2x` (high quality)
- Format: PNG
- Filename pattern: `daily-bias-{instrument}-{YYYY-MM-DD}.png`

### 4. Service Layer Updates

Updated `src/services/ai/daily-bias-service.ts` to import the `TechnicalAnalysis` type alias for consistency.

## Usage

### Data Sources
When the AI services generate analysis results, they can now include a `dataSources` array:
```typescript
{
  securityAnalysis: {
    instrument: "NQ1",
    dataSources: ["Bloomberg", "TradingView", "FRED"],
    // ... other fields
  }
}
```

The sources will automatically display in the card header below the instrument name and timestamp.

### Export Feature
1. User performs a daily bias analysis
2. Analysis results display on screen
3. User clicks "Export Analysis" button at the bottom
4. System captures the entire analysis section as a high-quality PNG
5. Image downloads automatically to user's device
6. Toast notification confirms successful export

## Technical Notes

### html2canvas Configuration
- `backgroundColor`: Matches dark theme (`#09090b`)
- `scale: 2`: Provides 2x resolution for crisp text
- `useCORS: true`: Allows cross-origin images if any
- `logging: false`: Suppresses console logs

### Error Handling
- Try-catch block wraps export logic
- User-friendly error toast on failure
- URL cleanup after download to prevent memory leaks

### UX Considerations
- Loading state prevents multiple simultaneous exports
- Button disables during export process
- Toast provides feedback on completion
- Filename includes instrument and date for easy organization

## Future Enhancements

Potential improvements:
1. Add option to export as PDF
2. Include export date/time in filename
3. Add watermark or branding to exported image
4. Allow selecting specific sections to export
5. Batch export multiple analyses
6. Email export option
7. Cloud storage integration

## Testing Checklist

- [ ] Data sources display correctly when provided
- [ ] Data sources hidden when not provided (graceful degradation)
- [ ] Export button appears after analysis completes
- [ ] Export captures full analysis content
- [ ] Downloaded image is high quality and readable
- [ ] Dark theme colors preserved in export
- [ ] Loading state displays during export
- [ ] Error toast shows on export failure
- [ ] Multiple exports work sequentially
- [ ] Works on different screen sizes

## Files Changed Summary

```
Modified:
- src/types/daily-bias.ts
- src/components/daily-bias/security-analysis-card.tsx
- src/components/daily-bias/institutional-flux-card.tsx
- src/components/daily-bias/mag7-analysis-card.tsx
- src/components/daily-bias/technical-analysis-card.tsx
- src/app/(dashboard)/daily-bias/daily-bias-content.tsx
- src/services/ai/daily-bias-service.ts

Added Dependencies:
- html2canvas@1.4.1
```

## Deployment Notes

No environment variables or configuration changes required.
The export feature works entirely client-side.
