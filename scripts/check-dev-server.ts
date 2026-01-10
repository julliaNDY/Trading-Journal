#!/usr/bin/env node
/**
 * Script pour vérifier si le serveur de développement Next.js est déjà en cours d'exécution
 * Usage: tsx scripts/check-dev-server.ts [--kill]
 */

import { createServer } from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DEFAULT_PORT = 3000;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;

/**
 * Vérifie si un port est disponible
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });

    server.on('error', () => resolve(false));
  });
}

/**
 * Trouve le PID du processus utilisant le port
 */
async function findProcessOnPort(port: number): Promise<string | null> {
  try {
    const platform = process.platform;
    let command: string;

    if (platform === 'darwin' || platform === 'linux') {
      // macOS/Linux
      command = `lsof -ti:${port}`;
    } else if (platform === 'win32') {
      // Windows
      command = `netstat -ano | findstr :${port} | findstr LISTENING`;
    } else {
      return null;
    }

    const { stdout } = await execAsync(command);
    const pid = stdout.trim().split('\n')[0]?.trim();
    return pid || null;
  } catch (error) {
    // Port non utilisé ou erreur de commande
    return null;
  }
}

/**
 * Tue le processus sur le port (optionnel)
 */
async function killProcessOnPort(port: number): Promise<boolean> {
  const pid = await findProcessOnPort(port);
  if (!pid) {
    return false;
  }

  try {
    const platform = process.platform;
    let command: string;

    if (platform === 'darwin' || platform === 'linux') {
      command = `kill -9 ${pid}`;
    } else if (platform === 'win32') {
      command = `taskkill /F /PID ${pid}`;
    } else {
      return false;
    }

    await execAsync(command);
    return true;
  } catch (error) {
    console.error(`Erreur lors de l'arrêt du processus ${pid}:`, error);
    return false;
  }
}

/**
 * Fonction principale
 */
async function main() {
  const shouldKill = process.argv.includes('--kill');
  const checkOnly = process.argv.includes('--check');

  console.log(`🔍 Vérification du port ${PORT}...`);

  const available = await isPortAvailable(PORT);

  if (available) {
    console.log(`✅ Le port ${PORT} est disponible`);
    process.exit(0);
  }

  const pid = await findProcessOnPort(PORT);
  
  if (pid) {
    console.log(`⚠️  Le port ${PORT} est déjà utilisé par le processus PID: ${pid}`);
    
    if (shouldKill) {
      console.log(`🛑 Arrêt du processus ${pid}...`);
      const killed = await killProcessOnPort(PORT);
      
      if (killed) {
        console.log(`✅ Processus arrêté avec succès`);
        // Attendre un peu pour que le port soit libéré
        await new Promise(resolve => setTimeout(resolve, 1000));
        process.exit(0);
      } else {
        console.error(`❌ Impossible d'arrêter le processus`);
        process.exit(1);
      }
    } else if (checkOnly) {
      console.log(`ℹ️  Utilisez --kill pour arrêter automatiquement le processus`);
      process.exit(1);
    } else {
      // Mode interactif (pas d'option)
      console.log(`\n💡 Options:`);
      console.log(`   - Utilisez "npm run dev:check" pour vérifier seulement`);
      console.log(`   - Utilisez "npm run dev:kill" pour arrêter le processus et démarrer`);
      console.log(`   - Ou tuez manuellement le processus avec: kill -9 ${pid}`);
      process.exit(1);
    }
  } else {
    console.log(`⚠️  Le port ${PORT} semble être utilisé mais aucun processus n'a été trouvé`);
    console.log(`💡 Essayez de redémarrer votre terminal ou vérifiez les processus avec: lsof -i:${PORT}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Erreur:', error);
  process.exit(1);
});