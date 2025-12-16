import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';

const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR || 'backups';
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';
const RETENTION_DAYS = 14;

function getDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

async function dumpDatabase(outputPath: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Parse MySQL connection string
  const match = databaseUrl.match(
    /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/
  );

  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }

  const [, user, password, host, port, database] = match;

  // Use mysqldump command
  const command = `mysqldump -h ${host} -P ${port} -u ${user} -p'${password}' ${database} > ${outputPath}`;

  try {
    await execAsync(command);
    console.log(`✓ Database dumped to ${outputPath}`);
  } catch (error) {
    console.error('Error dumping database:', error);
    throw error;
  }
}

async function createZipArchive(
  outputPath: string,
  files: { path: string; name: string }[],
  directories: { path: string; name: string }[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`✓ Archive created: ${outputPath} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add files
    for (const file of files) {
      archive.file(file.path, { name: file.name });
    }

    // Add directories
    for (const dir of directories) {
      archive.directory(dir.path, dir.name);
    }

    archive.finalize();
  });
}

async function cleanOldBackups(): Promise<void> {
  const backupDir = path.join(process.cwd(), BACKUP_DIR);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  try {
    const files = await fs.readdir(backupDir);

    for (const file of files) {
      if (!file.startsWith('backup-') || !file.endsWith('.zip')) continue;

      // Extract date from filename (backup-YYYY-MM-DD.zip)
      const dateMatch = file.match(/backup-(\d{4}-\d{2}-\d{2})\.zip/);
      if (!dateMatch) continue;

      const fileDate = new Date(dateMatch[1]);
      if (fileDate < cutoffDate) {
        const filePath = path.join(backupDir, file);
        await fs.unlink(filePath);
        console.log(`✓ Deleted old backup: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning old backups:', error);
  }
}

async function main(): Promise<void> {
  console.log('🚀 Starting backup process...\n');

  const dateStr = getDateString();
  const backupDir = path.join(process.cwd(), BACKUP_DIR);
  const uploadDir = path.join(process.cwd(), UPLOAD_DIR);

  // Ensure backup directory exists
  await ensureDir(backupDir);

  const sqlFile = path.join(backupDir, `db-${dateStr}.sql`);
  const zipFile = path.join(backupDir, `backup-${dateStr}.zip`);

  try {
    // Step 1: Dump database
    console.log('📦 Dumping database...');
    await dumpDatabase(sqlFile);

    // Step 2: Create zip archive
    console.log('\n📁 Creating archive...');
    
    // Check if uploads directory exists
    let directories: { path: string; name: string }[] = [];
    try {
      await fs.access(uploadDir);
      directories.push({ path: uploadDir, name: 'uploads' });
    } catch {
      console.log('ℹ️ No uploads directory found, skipping');
    }

    await createZipArchive(
      zipFile,
      [{ path: sqlFile, name: `db-${dateStr}.sql` }],
      directories
    );

    // Step 3: Clean up SQL file (keep only zip)
    await fs.unlink(sqlFile);

    // Step 4: Clean old backups
    console.log('\n🧹 Cleaning old backups...');
    await cleanOldBackups();

    console.log('\n✅ Backup completed successfully!');
    console.log(`   Archive: ${zipFile}`);
  } catch (error) {
    console.error('\n❌ Backup failed:', error);
    process.exit(1);
  }
}

main();






