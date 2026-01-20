/**
 * Charles Schwab OAuth Callback Handler
 * 
 * GET /api/broker/schwab/callback
 * 
 * Handles the OAuth 2.0 callback from Charles Schwab after user authorization.
 * 
 * Flow:
 * 1. User clicks "Connect Schwab" → redirected to Schwab login
 * 2. User authorizes → Schwab redirects back to this endpoint with code
 * 3. This endpoint exchanges code for access token
 * 4. Saves connection to database
 * 5. Redirects user to success page
 * 
 * @module api/broker/schwab/callback
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
      return NextResponse.redirect(
        new URL('/login?error=unauthorized', request.url)
      );
    }

    // Extract OAuth parameters from URL
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      brokerLogger.error('Schwab OAuth error', {
        error,
        errorDescription,
        userId: user.id,
      });

      return NextResponse.redirect(
        new URL(
          `/comptes/brokers?error=${encodeURIComponent(errorDescription || error)}`,
          request.url
        )
      );
    }

    // Validate required parameters
    if (!code) {
      return NextResponse.redirect(
        new URL('/comptes/brokers?error=missing_code', request.url)
      );
    }

    if (!state) {
      return NextResponse.redirect(
        new URL('/comptes/brokers?error=missing_state', request.url)
      );
    }

    // Create OAuth service
    const oauthService = new SchwabOAuthService();
    
    // Handle OAuth callback
    const result = await oauthService.handleCallback(user.id, code, state);

    brokerLogger.info('Schwab OAuth callback successful', {
      userId: user.id,
      connectionId: result.connectionId,
      accountIds: result.accountIds,
    });

    // Redirect to success page
    return NextResponse.redirect(
      new URL('/comptes/brokers?success=schwab_connected', request.url)
    );
  } catch (error) {
    brokerLogger.error('Schwab OAuth callback error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.redirect(
      new URL(
        `/comptes/brokers?error=${encodeURIComponent(
          error instanceof Error ? error.message : 'Unknown error'
        )}`,
        request.url
      )
    );
  }
}
