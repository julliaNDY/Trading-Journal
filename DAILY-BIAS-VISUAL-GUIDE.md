# Daily Bias - Visual Implementation Guide

## Feature 1: Data Sources Display

### Before:
```
┌─────────────────────────────────────────┐
│ 🛡️ Security Analysis        [MEDIUM]    │
├─────────────────────────────────────────┤
│ NQ1 • Jan 20, 2026, 10:30 AM           │
└─────────────────────────────────────────┘
```

### After:
```
┌─────────────────────────────────────────┐
│ 🛡️ Security Analysis        [MEDIUM]    │
├─────────────────────────────────────────┤
│ NQ1 • Jan 20, 2026, 10:30 AM           │
│ Sources: Bloomberg, TradingView, FRED   │ ← NEW!
└─────────────────────────────────────────┘
```

### Implementation in All Analysis Cards:
✅ Security Analysis Card
✅ Institutional Flux Card  
✅ Mag 7 Leaders Card
✅ Technical Structure Card

### Code Location:
Each card's `CardDescription` component now includes:
```tsx
{analysis.dataSources && analysis.dataSources.length > 0 && (
  <div className="text-xs text-muted-foreground">
    <strong>Sources:</strong> {analysis.dataSources.join(', ')}
  </div>
)}
```

---

## Feature 2: Export Analysis Button

### Layout:
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ✅ Analysis Complete! NQ1 analyzed in 2543ms      │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Security Card]    [Macro Card]                   │
│  [Flux Card]        [Mag7 Card]                    │
│  [Technical Card]                                  │
│                                                     │
│  [────── Synthesis Card (full width) ──────]       │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│              [ ⬇️  Export Analysis ]   ← NEW!      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Button States:

#### Ready State:
```
┌────────────────────────┐
│  ⬇️  Export Analysis   │
└────────────────────────┘
```

#### Loading State:
```
┌────────────────────────┐
│  ⏳  Exporting...      │
└────────────────────────┘
```

### Export Process:

```
User clicks "Export Analysis"
         ↓
    [Converting to canvas...]
         ↓
    [Generating PNG image...]
         ↓
    [Creating download link...]
         ↓
  Download: daily-bias-NQ1-2026-01-20.png
         ↓
    ✅ Toast: "Export Successful!"
```

---

## Technical Specifications

### Export Settings:
- **Format**: PNG
- **Quality**: 2x scale (high DPI)
- **Background**: Dark theme (#09090b)
- **Filename**: `daily-bias-{instrument}-{date}.png`
- **Size**: Captures full analysis container

### Data Sources Format:
- **Type**: `string[]` (optional)
- **Display**: Comma-separated list
- **Location**: Below instrument name in card header
- **Style**: Small, muted text with bold "Sources:" label

---

## Example Data Flow

### 1. Analysis Request:
```typescript
POST /api/daily-bias/analyze
{
  instrument: "NQ1",
  date: "2026-01-20"
}
```

### 2. Response with Data Sources:
```typescript
{
  success: true,
  data: {
    securityAnalysis: {
      instrument: "NQ1",
      dataSources: ["Bloomberg", "TradingView"], // ← New field
      volatilityIndex: 65,
      // ... other fields
    },
    institutionalFlux: {
      instrument: "NQ1",
      dataSources: ["NYSE Tick Data", "Order Flow API"],
      fluxScore: 7.2,
      // ... other fields
    }
    // ... other analysis steps
  }
}
```

### 3. UI Rendering:
Each card displays its own data sources if provided.

### 4. Export Action:
```typescript
handleExportAnalysis() {
  // Capture analysis container
  html2canvas(analysisContainerRef.current, {
    backgroundColor: '#09090b',
    scale: 2
  })
  // Convert to blob
  // Trigger download
  // Show toast
}
```

---

## User Experience Flow

### Scenario: Daily Morning Analysis

1. **Select Instrument**
   ```
   User selects: NQ1
   ↓
   Clicks "Analyze"
   ```

2. **View Results**
   ```
   6 analysis cards appear
   Each shows:
   - Analysis data
   - Instrument & timestamp
   - Data sources used  ← NEW!
   ```

3. **Export for Reference**
   ```
   User scrolls to bottom
   ↓
   Clicks "Export Analysis"
   ↓
   PNG downloads automatically
   ↓
   Can share or archive for later
   ```

---

## Mobile Responsiveness

### Desktop (≥768px):
```
┌─────────────────────────────────┐
│  [Card 1]       [Card 2]        │
│  [Card 3]       [Card 4]        │
│  [Card 5]                       │
│  [Synthesis - Full Width]       │
│      [Export Button]            │
└─────────────────────────────────┘
```

### Mobile (<768px):
```
┌───────────────┐
│   [Card 1]    │
│   [Card 2]    │
│   [Card 3]    │
│   [Card 4]    │
│   [Card 5]    │
│  [Synthesis]  │
│    [Export]   │
└───────────────┘
```

---

## Error Handling

### If Export Fails:
```
🔴 Export Failed
   Failed to export analysis

[Dismiss]
```

### If No Data Sources:
```
Card displays normally without sources line
(Graceful degradation - no error)
```

---

## Browser Compatibility

### html2canvas Support:
✅ Chrome/Edge (latest)
✅ Firefox (latest)
✅ Safari (latest)
✅ Mobile browsers (iOS/Android)

### Fallback:
If export fails, user sees error toast and can:
- Take manual screenshot
- Try export again
- Report issue

---

## Performance Considerations

### Export Time:
- Small analysis: ~500ms
- Large analysis: ~1-2s
- Shows loading state during capture

### Memory:
- Canvas temporarily uses ~5-10MB
- Cleanup performed after download
- No persistent memory impact

---

## Styling Details

### Data Sources:
```css
.text-xs            /* 12px font */
.text-muted-foreground  /* Subtle gray color */
```

### Export Button:
```css
size="lg"           /* Large, prominent */
variant="outline"   /* Subtle border style */
.min-w-[200px]      /* Minimum width for consistency */
```

### Spacing:
```css
.pt-4               /* 16px top padding above button */
.space-y-1          /* 4px between description lines */
```

---

## Keyboard Accessibility

### Tab Navigation:
```
[Analyze Button] → ... → [Export Button]
                            ↓
                    Press Enter to export
```

### Screen Readers:
- Button announces: "Export Analysis, button"
- Loading state: "Exporting, busy"
- Success: Toast announces completion

---

## Future Enhancement Ideas

1. **Export Options Menu**
   ```
   [Export ▼]
   ├── As PNG (current)
   ├── As PDF
   ├── Send via Email
   └── Save to Cloud
   ```

2. **Batch Export**
   ```
   Select multiple analyses
   Export all at once as ZIP
   ```

3. **Scheduled Exports**
   ```
   Auto-export daily at market close
   Email to user
   ```

4. **Custom Branding**
   ```
   Add logo watermark
   Include trader name
   Timestamp on image
   ```

---

## Testing Scenarios

### ✅ Happy Path:
1. Perform analysis
2. Wait for results
3. Click export
4. Verify download
5. Open PNG - should be readable

### ✅ Edge Cases:
- Export with no data sources (should work)
- Export immediately after results load
- Multiple consecutive exports
- Export on mobile device
- Export with very long instrument names

### ✅ Error Cases:
- Browser blocks downloads (show instruction)
- Canvas rendering fails (show error toast)
- Out of memory (handle gracefully)

---

## Development Notes

### Why html2canvas?
- ✅ Pure JavaScript, no server needed
- ✅ Works with React components
- ✅ Handles CSS styling well
- ✅ Good mobile support
- ✅ Active maintenance

### Alternative Considered:
- jsPDF: More complex, PDF-focused
- dom-to-image: Less maintained
- Native browser APIs: Limited browser support

### Installation:
```bash
npm install html2canvas --legacy-peer-deps
```

(Used `--legacy-peer-deps` due to ESLint version conflicts in project)

