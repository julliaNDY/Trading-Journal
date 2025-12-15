import { promises as fs } from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

export interface StorageProvider {
  save(file: File, subdir: string): Promise<string>;
  delete(filePath: string): Promise<void>;
  getUrl(filePath: string): string;
}

// Filesystem storage provider (for MVP)
export class FilesystemStorage implements StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), UPLOAD_DIR);
  }

  async save(file: File, subdir: string): Promise<string> {
    const dir = path.join(this.baseDir, subdir);
    await fs.mkdir(dir, { recursive: true });

    // Generate unique filename
    const ext = path.extname(file.name);
    const basename = path.basename(file.name, ext);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `${basename}-${timestamp}-${random}${ext}`;

    const filePath = path.join(dir, filename);
    const relativePath = path.join(subdir, filename);

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

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

