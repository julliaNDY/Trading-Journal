/**
 * Daily Bias Page
 * 
 * Story 12.1: Instrument Selection & Analysis Request
 * Main page for AI-powered daily bias analysis (6-step process)
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { DailyBiasContent } from './daily-bias-content';

export const metadata: Metadata = {
  title: 'Daily Bias Analysis | Trading Journal',
  description: 'AI-powered 6-step daily bias analysis for trading instruments'
};

export default function DailyBiasPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Daily Bias Analysis</h1>
          <p className="text-muted-foreground">
            AI-powered 6-step fundamental analysis which helps you determine your daily bias
          </p>
        </div>
        
        {/* Main Content */}
        <Suspense fallback={<div>Loading...</div>}>
          <DailyBiasContent />
        </Suspense>
      </div>
    </div>
  );
}
