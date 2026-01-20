/**
 * Daily Bias Content Component
 * 
 * Client component that handles the main daily bias analysis UI
 * Instrument selection + Analysis trigger + Results display
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InstrumentSelector } from '@/components/daily-bias/instrument-selector';
import { 
  SecurityAnalysisCard,
  MacroAnalysisCard,
  InstitutionalFluxCard,
  Mag7AnalysisCard,
  TechnicalAnalysisCard,
  SynthesisCard,
  SynthesisTab
} from '@/components/daily-bias';
import { Loader2, AlertCircle, Target, Wifi, WifiOff, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDailyBiasRealtime } from '@/hooks/use-daily-bias-realtime';
import type { DailyBiasAnalysisResult } from '@/services/ai/daily-bias-service';
import type { ValidInstrument } from '@/types/daily-bias';
import html2canvas from 'html2canvas';

export function DailyBiasContent() {
  const [selectedInstrument, setSelectedInstrument] = useState<ValidInstrument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DailyBiasAnalysisResult | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    allowed: boolean;
    nextAvailable: string | null;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  
  const { toast } = useToast();
  const analysisContainerRef = useRef<HTMLDivElement>(null);
  
  // Real-time updates hook - TEMPORARILY DISABLED to fix infinite loop
  const realtime = useDailyBiasRealtime({
    instrument: selectedInstrument,
    date: new Date().toISOString().split('T')[0],
    enabled: false, // DISABLED: was causing infinite loop with polling
    onUpdate: (updatedAnalysis) => {
      // Update analysis when real-time update received
      setAnalysis(updatedAnalysis);
      
      // Show toast notification
      toast({
        title: 'Analysis Updated',
        description: `New analysis available for ${selectedInstrument}`,
        variant: 'default',
      });
    },
    onError: (err) => {
      // Log error but don't show toast for connection errors (normal fallback behavior)
      console.warn('Real-time update error:', err);
    },
    pollingInterval: 5000, // 5 seconds fallback polling
  });
  
  // Show connection status changes
  useEffect(() => {
    if (realtime.isConnected && selectedInstrument && analysis) {
      // Connection established - no need to notify (quiet connection)
    } else if (realtime.isPolling && selectedInstrument && analysis) {
      // Fallback to polling - can show subtle indicator if needed
    }
  }, [realtime.isConnected, realtime.isPolling, selectedInstrument, analysis]);
  
  const handleAnalyze = async () => {
    if (!selectedInstrument) return;
    
    setLoading(true);
    setError(null);
    setAnalysis(null);
    
    try {
      const response = await fetch('/api/daily-bias/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          instrument: selectedInstrument,
          date: new Date().toISOString().split('T')[0]
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        if (result.error.code === 'RATE_LIMIT_EXCEEDED') {
          setRateLimitInfo({
            allowed: false,
            nextAvailable: result.error.details.nextAvailable
          });
        }
        throw new Error(result.error.message);
      }
      
      setAnalysis(result.data);
      setRateLimitInfo({ allowed: true, nextAvailable: null });
      
    } catch (err: any) {
      setError(err.message || 'Failed to analyze. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const canAnalyze = selectedInstrument && !loading && (!rateLimitInfo || rateLimitInfo.allowed);
  
  const handleExportAnalysis = async () => {
    if (!analysisContainerRef.current || !analysis) return;
    
    setExporting(true);
    
    try {
      // Generate canvas from the analysis container
      const canvas = await html2canvas(analysisContainerRef.current, {
        backgroundColor: '#09090b', // Dark background
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
      });
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Failed to generate image');
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().split('T')[0];
        link.download = `daily-bias-${selectedInstrument}-${timestamp}.png`;
        link.href = url;
        link.click();
        
        // Cleanup
        URL.revokeObjectURL(url);
        
        toast({
          title: 'Export Successful',
          description: `Analysis exported as ${link.download}`,
          variant: 'default',
        });
      }, 'image/png');
      
    } catch (err: any) {
      console.error('Export failed:', err);
      toast({
        title: 'Export Failed',
        description: err.message || 'Failed to export analysis',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };
  
  return (
    <div className="space-y-8">
      {/* Instrument Selection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Select Instrument
          </CardTitle>
          <CardDescription>
            Choose an instrument to analyze.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <InstrumentSelector 
              value={selectedInstrument}
              onChange={setSelectedInstrument}
              disabled={loading}
            />
            
            <Button 
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              size="lg"
              className="md:w-auto w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Target className="mr-2 h-4 w-4" />
                  Analyze
                </>
              )}
            </Button>
          </div>
          
          {/* Rate Limit Info */}
          {selectedInstrument && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Rate Limit:</strong> 1 analysis per day.
                {rateLimitInfo && !rateLimitInfo.allowed && rateLimitInfo.nextAvailable && (
                  <span className="block mt-1 text-destructive">
                    Next analysis available: {new Date(rateLimitInfo.nextAvailable).toLocaleString()}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {/* Analysis Results - Loading State */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SecurityAnalysisCard analysis={null as any} loading={true} className="h-full" />
          <InstitutionalFluxCard analysis={null as any} loading={true} className="h-full" />
          <Mag7AnalysisCard analysis={null as any} loading={true} />
          <MacroAnalysisCard analysis={null as any} loading={true} />
          <div className="lg:col-span-2">
            <TechnicalAnalysisCard analysis={null as any} loading={true} />
          </div>
          <div className="lg:col-span-2">
            <SynthesisTab 
              synthesisText=""
              sentiment="NEUTRAL"
              confidence={0}
              loading={true}
            />
          </div>
        </div>
      )}
      
      {analysis && !loading && (
        <>
          <div ref={analysisContainerRef} className="space-y-6">
            {/* Analysis Metadata - Cached/Live badges */}
            <div className="flex items-center justify-end gap-2">
              {analysis.cacheHit && (
                <Badge variant="secondary" className="text-xs">Cached</Badge>
              )}
              {realtime.isConnected && (
                <Badge 
                  variant="default" 
                  className="text-xs flex items-center gap-1"
                  title="Real-time updates active"
                >
                  <Wifi className="h-3 w-3" />
                  Live
                </Badge>
              )}
              {realtime.isPolling && !realtime.isConnected && (
                <Badge 
                  variant="secondary" 
                  className="text-xs flex items-center gap-1"
                  title="Polling for updates"
                >
                  <WifiOff className="h-3 w-3" />
                  Polling
                </Badge>
              )}
              {realtime.lastUpdate && (
                <span className="text-xs text-muted-foreground">
                  Last update: {realtime.lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </div>
            
            {/* Analysis Cards Grid - All visible at once */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Step 1: Security Analysis */}
              {analysis.securityAnalysis && (
                <SecurityAnalysisCard 
                  analysis={analysis.securityAnalysis}
                  sentiment={analysis.synthesis?.finalBias}
                  className="border-2 shadow-sm hover:shadow-md transition-shadow h-full"
                />
              )}
              
              {/* Step 3: Institutional Flux (moved from position 3 to position 2) */}
              {analysis.institutionalFlux && (
                <InstitutionalFluxCard 
                  analysis={analysis.institutionalFlux}
                  sentiment={analysis.synthesis?.finalBias}
                  className="border-2 shadow-sm hover:shadow-md transition-shadow h-full"
                />
              )}
              
              {/* Step 4: MAG 7 Analysis (moved from position 4 to position 3) */}
              {analysis.mag7Analysis && (
                <Mag7AnalysisCard 
                  analysis={analysis.mag7Analysis}
                  className="border-2 shadow-sm hover:shadow-md transition-shadow"
                />
              )}
              
              {/* Step 2: Macro Analysis (moved from position 2 to position 4) */}
              {analysis.macroAnalysis && (
                <MacroAnalysisCard 
                  analysis={analysis.macroAnalysis}
                  className="border-2 shadow-sm hover:shadow-md transition-shadow"
                />
              )}
              
              {/* Step 5: Technical Analysis - Full width */}
              {analysis.technicalAnalysis && (
                <div className="lg:col-span-2">
                  <TechnicalAnalysisCard 
                    analysis={analysis.technicalAnalysis}
                    className="border-2 shadow-sm hover:shadow-md transition-shadow"
                  />
                </div>
              )}
              
              {/* Step 6: Synthesis - Full width */}
              {(analysis.synthesisText || analysis.synthesis) && (
                <div className="lg:col-span-2">
                  <SynthesisTab 
                    synthesisText={analysis.synthesisText || analysis.synthesis?.analysis?.summary || ''}
                    sentiment={analysis.synthesisSentiment || analysis.synthesis?.finalBias || 'NEUTRAL'}
                    confidence={analysis.synthesis?.confidence ? Math.round(analysis.synthesis.confidence * 100) : 70}
                    className="border-2 shadow-sm hover:shadow-md transition-shadow"
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Export Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={handleExportAnalysis}
              disabled={exporting}
              size="lg"
              variant="outline"
              className="min-w-[200px]"
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export Analysis
                </>
              )}
            </Button>
          </div>
        </>
      )}
      
      {/* Placeholder when no analysis */}
      {!loading && !analysis && !error && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Analysis Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Select an instrument above and click "Analyze" to generate a 6-step AI-powered daily bias analysis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
