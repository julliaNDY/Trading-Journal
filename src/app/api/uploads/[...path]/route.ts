import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

// Map file extensions to MIME types
const mimeTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  // Audio types for voice notes
  '.webm': 'audio/webm',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

/**
 * Verify user has access to the requested file
 * Files are organized as: uploads/{type}/{entityId}/{filename}
 * - trades/{tradeId}/... - user must own the trade
 * - days/{dayJournalId}/... - user must own the day journal
 * - voice-notes/{tradeId}/... - user must own the trade
 */
async function verifyFileAccess(filePath: string, userId: string): Promise<boolean> {
  const segments = filePath.split('/');
  
  if (segments.length < 2) return false;
  
  const [type, entityId] = segments;
  
  switch (type) {
    case 'trades':
    case 'voice-notes': {
      const trade = await prisma.trade.findFirst({
        where: { id: entityId, userId },
        select: { id: true },
      });
      return !!trade;
    }
    case 'days':
    case 'day-voice-notes': {
      const dayJournal = await prisma.dayJournal.findFirst({
        where: { id: entityId, userId },
        select: { id: true },
      });
      return !!dayJournal;
    }
    default:
      return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { path: pathSegments } = await params;
    
    // Join path segments and decode URI components
    const filePath = pathSegments.map(segment => decodeURIComponent(segment)).join('/');
    
    // Prevent directory traversal attacks
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    // Verify user has access to this file
    const hasAccess = await verifyFileAccess(normalizedPath, user.id);
    if (!hasAccess) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    // Build full file path
    const fullPath = path.join(process.cwd(), UPLOAD_DIR, normalizedPath);
    
    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return new NextResponse('Not Found', { status: 404 });
    }
    
    // Read file
    const fileBuffer = await fs.readFile(fullPath);
    
    // Get MIME type from extension
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

