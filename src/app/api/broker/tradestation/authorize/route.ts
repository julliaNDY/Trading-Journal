/**
 * TradeStation OAuth Authorization Initiator
 * 
 * Generates the OAuth authorization URL and redirects user to TradeStation login.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { createTradeStationProvider } from '@/services/broker/tradestation-provider';
import { brokerLogger } from '@/lib/logger';
import { randomBytes } from 'crypto';

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

    // Get environment from query params (default: live)
    const searchParams = request.nextUrl.searchParams;
    const environment = (searchParams.get('environment') as 'sim' | 'live') || 'live';

    // Generate random state for CSRF protection
    const state = randomBytes(32).toString('hex');

    // TODO: Store state in session or database for validation
    // For now, we'll skip this but it should be added for production

    // Create TradeStation provider
    const provider = createTradeStationProvider(environment);

    // Generate authorization URL
    const authUrl = provider.getAuthorizationUrl(state);

    brokerLogger.info('TradeStation OAuth initiated', {
      userId: user.id,
      environment,
      state,
    });

    // Redirect to TradeStation authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    brokerLogger.error('TradeStation OAuth initiation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
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
