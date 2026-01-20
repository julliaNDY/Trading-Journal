/**
 * Charles Schwab OAuth Authorization Initiator
 * 
 * GET /api/broker/schwab/authorize
 * 
 * Generates the OAuth authorization URL and redirects user to Schwab login.
 * 
 * @module api/broker/schwab/authorize
 * @created 2026-01-18
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { SchwabOAuthService } from '@/lib/schwab-oauth';
import { brokerLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create OAuth service
    const oauthService = new SchwabOAuthService();
    
    // Generate authorization URL
    const { url, state } = await oauthService.generateAuthUrl(user.id);

    brokerLogger.info('Schwab OAuth initiated', {
      userId: user.id,
      state,
    });

    // Redirect to Schwab authorization page
    return NextResponse.redirect(url);
  } catch (error) {
    brokerLogger.error('Schwab OAuth initiation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Failed to initiate OAuth',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
