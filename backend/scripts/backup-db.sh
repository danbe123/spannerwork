#!/bin/bash
#
# PostgreSQL Database Backup Script
#
# This script creates compressed backups of the PostgreSQL database
# and manages backup retention (default: 7 days).
#
# Usage: ./backup-db.sh [backup_dir]
#
# Environment Variables:
#   DATABASE_URL - PostgreSQL connection string (required)
#   BACKUP_RETENTION_DAYS - Number of days to keep backups (default: 7)
#   S3_BUCKET - Optional S3 bucket for remote backup storage
#   AWS_REGION - AWS region for S3 (required if S3_BUCKET is set)
#

set -euo pipefail

# Configuration
BACKUP_DIR="${1:-/var/backups/postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="spannerwork_backup_${TIMESTAMP}.sql.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check required environment variables
if [ -z "${DATABASE_URL:-}" ]; then
    log_error "DATABASE_URL environment variable is required"
    exit 1
fi

# Parse DATABASE_URL
# Format: postgresql://user:password@host:port/database
parse_db_url() {
    local url="$1"
    
    # Remove protocol
    url="${url#postgresql://}"
    url="${url#postgres://}"
    
    # Extract user:password
    local auth="${url%%@*}"
    DB_USER="${auth%%:*}"
    DB_PASSWORD="${auth#*:}"
    
    # Extract host:port/database
    local hostpart="${url#*@}"
    local hostport="${hostpart%%/*}"
    DB_HOST="${hostport%%:*}"
    DB_PORT="${hostport#*:}"
    DB_PORT="${DB_PORT:-5432}"
    
    # Extract database name (remove query params)
    DB_NAME="${hostpart#*/}"
    DB_NAME="${DB_NAME%%\?*}"
}

parse_db_url "$DATABASE_URL"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log_info "Starting database backup..."
log_info "Database: $DB_NAME on $DB_HOST:$DB_PORT"
log_info "Backup file: $BACKUP_FILE"

# Create backup using pg_dump
export PGPASSWORD="$DB_PASSWORD"

if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --format=plain \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    | gzip > "$BACKUP_DIR/$BACKUP_FILE"; then
    
    unset PGPASSWORD
    
    # Get backup size
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    log_info "Backup completed successfully: $BACKUP_SIZE"
    
    # Upload to S3 if configured
    if [ -n "${S3_BUCKET:-}" ]; then
        log_info "Uploading to S3: s3://$S3_BUCKET/backups/$BACKUP_FILE"
        if aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://$S3_BUCKET/backups/$BACKUP_FILE" \
            --region "${AWS_REGION:-us-east-1}"; then
            log_info "S3 upload completed"
        else
            log_error "S3 upload failed"
        fi
    fi
    
    # Clean up old backups
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "spannerwork_backup_*.sql.gz" -type f -mtime "+$RETENTION_DAYS" -delete
    
    # Count remaining backups
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "spannerwork_backup_*.sql.gz" -type f | wc -l)
    log_info "Cleanup complete. $BACKUP_COUNT backup(s) retained."
    
    # Clean up old S3 backups if configured
    if [ -n "${S3_BUCKET:-}" ]; then
        log_info "Cleaning up old S3 backups..."
        # List and delete old backups from S3
        aws s3 ls "s3://$S3_BUCKET/backups/" --region "${AWS_REGION:-us-east-1}" \
            | while read -r line; do
            createDate=$(echo "$line" | awk '{print $1" "$2}')
            createDate=$(date -d "$createDate" +%s 2>/dev/null || echo "0")
            olderThan=$(date -d "$RETENTION_DAYS days ago" +%s)
            if [ "$createDate" -lt "$olderThan" ]; then
                fileName=$(echo "$line" | awk '{print $4}')
                if [ -n "$fileName" ]; then
                    log_info "Deleting old S3 backup: $fileName"
                    aws s3 rm "s3://$S3_BUCKET/backups/$fileName" --region "${AWS_REGION:-us-east-1}"
                fi
            fi
        done
    fi
    
    log_info "Backup process completed successfully"
    exit 0
else
    unset PGPASSWORD
    log_error "Backup failed!"
    exit 1
fi
