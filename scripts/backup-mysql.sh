#!/bin/bash
# ===========================================
# Script de backup MySQL avant migration
# ===========================================

# Configuration - À MODIFIER avec vos valeurs
MYSQL_HOST="votre-host-mysql"
MYSQL_USER="votre-user"
MYSQL_DB="votre-database"
BACKUP_DIR="./backups/mysql-migration"

# Créer le dossier de backup
mkdir -p "$BACKUP_DIR"

# Nom du fichier avec timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${MYSQL_DB}_${TIMESTAMP}.sql"

echo "🔐 Backup MySQL - Trading Journal"
echo "=================================="
echo "Host: $MYSQL_HOST"
echo "Database: $MYSQL_DB"
echo "Destination: $BACKUP_FILE"
echo ""

# Exécuter le dump (demandera le mot de passe)
echo "Entrez le mot de passe MySQL :"
mysqldump \
  --host="$MYSQL_HOST" \
  --user="$MYSQL_USER" \
  --password \
  --single-transaction \
  --routines \
  --triggers \
  --add-drop-table \
  "$MYSQL_DB" > "$BACKUP_FILE"

# Vérifier si le backup a réussi
if [ $? -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
  # Compresser le backup
  gzip "$BACKUP_FILE"
  FINAL_FILE="${BACKUP_FILE}.gz"
  SIZE=$(du -h "$FINAL_FILE" | cut -f1)
  
  echo ""
  echo "✅ Backup réussi !"
  echo "   Fichier: $FINAL_FILE"
  echo "   Taille: $SIZE"
  echo ""
  echo "📋 Pour restaurer si nécessaire :"
  echo "   gunzip $FINAL_FILE"
  echo "   mysql -h $MYSQL_HOST -u $MYSQL_USER -p $MYSQL_DB < ${BACKUP_FILE}"
else
  echo ""
  echo "❌ Erreur lors du backup !"
  echo "   Vérifiez vos identifiants et la connexion."
  rm -f "$BACKUP_FILE"
  exit 1
fi

