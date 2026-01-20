/**
 * TradeStation OAuth Callback Handler
 * 
 * Handles the OAuth 2.0 callback from TradeStation after user authorization.
 * 
 * Flow:
 * 1. User clicks "Connect TradeStation" → redirected to TradeStation login
 * 2. User authorizes → TradeStation redirects back to this endpoint with code
 * 3. This endpoint exchanges code for access token
 * 4. Saves connection to database
 * 5. Redirects user to success page
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createTradeStationProvider, TradeStationCredentials } from '@/services/broker/tradestation-provider';
import { encryptCredential } from '@/services/broker/broker-sync-service';
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
      brokerLogger.error('TradeStation OAuth error', {
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

    // Verify state (CSRF protection)
    // TODO: Implement state validation
    // For now, we'll skip this but it should be added for production

    // Determine environment (sim or live)
    // For now, default to live. Could be passed via state parameter
    const environment = 'live';

    // Create TradeStation provider
    const provider = createTradeStationProvider(environment);

    // Exchange authorization code for access token
    const authResult = await provider.authenticate({
      apiKey: '', // Not used for OAuth
      apiSecret: '', // Not used for OAuth
      authorizationCode: code,
    } as TradeStationCredentials);

    brokerLogger.info('TradeStation OAuth successful', {
      userId: user.id,
      expiresAt: authResult.expiresAt,
    });

    // Fetch user's accounts
    const accounts = await provider.getAccounts(authResult.accessToken);

    if (accounts.length === 0) {
      return NextResponse.redirect(
        new URL('/comptes/brokers?error=no_accounts', request.url)
      );
    }

    // For now, connect the first account
    // TODO: Allow user to select which account to connect
    const account = accounts[0];

    // Encrypt access token (we'll store it as apiKey for consistency)
    const encryptedAccessToken = encryptCredential(authResult.accessToken);

    // Encrypt refresh token (stored as apiSecret)
    // Note: We need to get refresh token from OAuth response
    // For now, we'll store empty string
    const encryptedRefreshToken = encryptCredential('');

    // Create broker connection in database
    const connection = await prisma.brokerConnection.create({
      data: {
        userId: user.id,
        brokerType: 'TRADESTATION',
        status: 'CONNECTED',
        encryptedApiKey: encryptedAccessToken,
        encryptedApiSecret: encryptedRefreshToken,
        accessToken: authResult.accessToken,
        tokenExpiresAt: authResult.expiresAt,
        brokerAccountId: account.id,
        brokerAccountName: account.name,
        syncEnabled: true,
        syncIntervalMin: 15,
      },
    });

    brokerLogger.info('TradeStation connection created', {
      userId: user.id,
      connectionId: connection.id,
      accountId: account.id,
    });

    // Redirect to success page
    return NextResponse.redirect(
      new URL('/comptes/brokers?success=connected', request.url)
    );
  } catch (error) {
    brokerLogger.error('TradeStation OAuth callback error', {
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
