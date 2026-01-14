import { promises as fs } from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

export interface StorageProvider {
  save(file: File, subdir: string): Promise<string>;
  delete(filePath: string): Promise<void>;
  getUrl(filePath: string): string;
}

// Sanitize filename to remove special characters that cause URL issues
function sanitizeFilename(filename: string): string {
  // Remove or replace problematic characters
  return filename
    // Normalize unicode characters (é -> e, à -> a, etc.)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace spaces with underscores
    .replace(/\s+/g, '_')
    // Remove apostrophes and quotes
    .replace(/['"]/g, '')
    // Remove other special characters except alphanumeric, underscore, hyphen, and dot
    .replace(/[^a-zA-Z0-9_\-\.]/g, '')
    // Remove multiple consecutive underscores/hyphens
    .replace(/[_-]+/g, '_')
    // Ensure it doesn't start or end with underscore/hyphen
    .replace(/^[_-]+|[_-]+$/g, '');
}

// Filesystem storage provider (for MVP)
export class FilesystemStorage implements StorageProvider {
  private baseDir: string;

  constructor() {
    const cwd = process.cwd();
    this.baseDir = path.join(cwd, UPLOAD_DIR);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/services/storage-service.ts:35',message:'FilesystemStorage constructor',data:{UPLOAD_DIR,processCwd:cwd,baseDir:this.baseDir},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
  }

  async save(file: File, subdir: string): Promise<string> {
    const dir = path.join(this.baseDir, subdir);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/services/storage-service.ts:39',message:'save() called - before mkdir',data:{subdir,fullDir:dir,fileName:file.name,fileSize:file.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    try {
      await fs.mkdir(dir, { recursive: true });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/services/storage-service.ts:43',message:'mkdir successful',data:{dir},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/services/storage-service.ts:46',message:'mkdir failed',data:{dir,error:error?.message,errorCode:error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      throw error;
    }

    // Generate unique filename with sanitized basename
    const ext = path.extname(file.name);
    const rawBasename = path.basename(file.name, ext);
    const basename = sanitizeFilename(rawBasename) || 'image';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `${basename}-${timestamp}-${random}${ext}`;

    const filePath = path.join(dir, filename);
    const relativePath = path.join(subdir, filename);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/services/storage-service.ts:57',message:'before writeFile',data:{filePath,relativePath,bufferSize:file.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    // Write file
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/services/storage-service.ts:62',message:'writeFile successful',data:{filePath,relativePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/services/storage-service.ts:66',message:'writeFile failed',data:{filePath,error:error?.message,errorCode:error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      throw error;
    }

    return relativePath;
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // File might not exist, ignore error
      console.error('Error deleting file:', error);
    }
  }

  getUrl(filePath: string): string {
    return `/uploads/${filePath}`;
  }
}

// Export singleton instance
export const storage = new FilesystemStorage();

// Helper function to create upload directories
export async function ensureUploadDirs(): Promise<void> {
  const dirs = ['trades', 'days'];
  for (const dir of dirs) {
    const fullPath = path.join(process.cwd(), UPLOAD_DIR, dir);
    await fs.mkdir(fullPath, { recursive: true });
  }
}

// Validate file type
export function isValidImageType(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  return validTypes.includes(file.type);
}

// Validate file size (max 10MB)
export function isValidFileSize(file: File, maxSizeMB: number = 10): boolean {
  return file.size <= maxSizeMB * 1024 * 1024;
}






