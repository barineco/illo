# backup.sh - Backup and restore commands
# This file is sourced by install.sh - do not execute directly

################################################################################
# Main Entry Points (subcommand dispatchers)
################################################################################

cmd_backup() {
    local subcommand="${1:-}"

    case "$subcommand" in
        db)
            cmd_backup_db
            ;;
        full)
            cmd_backup_full
            ;;
        list|ls)
            cmd_backup_list
            ;;
        "")
            echo ""
            print_error "Please specify backup type"
            echo ""
            echo "Usage: ./install.sh backup <type>"
            echo ""
            echo "Types:"
            echo "  db      Database only (PostgreSQL)"
            echo "  full    Full backup (database + MinIO + .env)"
            echo "  list    List available backups"
            echo ""
            exit 1
            ;;
        *)
            print_error "Unknown backup type: $subcommand"
            echo ""
            echo "Valid types: db, full, list"
            exit 1
            ;;
    esac
}

cmd_restore() {
    local subcommand="${1:-}"
    shift 2>/dev/null || true

    case "$subcommand" in
        db)
            cmd_restore_db "$@"
            ;;
        full)
            cmd_restore_full "$@"
            ;;
        "")
            echo ""
            print_error "Please specify restore type"
            echo ""
            echo "Usage: ./install.sh restore <type> [file]"
            echo ""
            echo "Types:"
            echo "  db <file>    Restore database from .sql.gz backup"
            echo "  full <file>  Full restore from .tar.gz backup"
            echo ""
            cmd_backup_list
            exit 1
            ;;
        *)
            print_error "Unknown restore type: $subcommand"
            echo ""
            echo "Valid types: db, full"
            exit 1
            ;;
    esac
}

################################################################################
# Backup Format
################################################################################
# Full backup creates a directory with the following structure:
#   backup_YYYYMMDD_HHMMSS/
#   ├── manifest.json        # Backup metadata and version info
#   ├── database.sql.gz      # PostgreSQL dump
#   ├── env.enc              # Encrypted .env file (optional)
#   ├── env.sha256           # Hash for integrity verification
#   └── minio/               # MinIO data (if included)
#       └── <bucket>/        # Bucket contents
#
# The directory is then compressed into a single .tar.gz file

################################################################################
# Database-only Backup
################################################################################

cmd_backup_db() {
    echo ""
    echo -e "${BOLD}Database Backup${NC}"
    echo ""

    mkdir -p "$BACKUP_DIR"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/db_backup_${timestamp}.sql"

    load_env

    local postgres_container=$(get_container_name "postgres")
    local db_user="${POSTGRES_USER:-illustboard_user}"
    local db_name="${POSTGRES_DB:-illustboard_db}"

    if ! docker ps --format '{{.Names}}' | grep -q "^${postgres_container}$"; then
        print_error "PostgreSQL container is not running"
        exit 1
    fi

    start_spinner "Creating database backup..."

    # Use --data-only --column-inserts for schema-change resilient backups
    # - --data-only: Don't dump schema (current migration state is preserved)
    # - --column-inserts: Generate INSERT with column names (tolerant of schema changes)
    # - --disable-triggers: Prevent FK constraint issues during restore
    docker exec "$postgres_container" \
        pg_dump -U "$db_user" -d "$db_name" \
        --data-only \
        --column-inserts \
        --no-owner --no-acl \
        --disable-triggers \
        > "$backup_file"

    if [ $? -eq 0 ]; then
        gzip "$backup_file"
        local compressed_file="${backup_file}.gz"
        local size=$(ls -lh "$compressed_file" | awk '{print $5}')

        stop_spinner true "Backup created"

        echo ""
        echo -e "  ${CHECK} File: ${CYAN}$compressed_file${NC}"
        echo -e "  ${CHECK} Size: $size"
        echo ""
        echo -e "  ${ARROW} Restore with: ${CYAN}./install.sh restore db $compressed_file${NC}"
    else
        stop_spinner false "Backup failed"
        rm -f "$backup_file"
        exit 1
    fi

    echo ""
}

################################################################################
# Full Backup (Database + MinIO + .env)
################################################################################

cmd_backup_full() {
    echo ""
    echo -e "${BOLD}Full Instance Backup${NC}"
    echo ""

    mkdir -p "$BACKUP_DIR"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="backup_${timestamp}"
    local backup_path="$BACKUP_DIR/$backup_name"
    local final_archive="$BACKUP_DIR/${backup_name}.tar.gz"

    # Create backup directory
    mkdir -p "$backup_path"
    mkdir -p "$backup_path/minio"

    load_env

    local postgres_container=$(get_container_name "postgres")
    local minio_container=$(get_container_name "minio")
    local db_user="${POSTGRES_USER:-illustboard_user}"
    local db_name="${POSTGRES_DB:-illustboard_db}"
    local minio_bucket="${S3_BUCKET:-illustboard}"

    # Check containers
    if ! docker ps --format '{{.Names}}' | grep -q "^${postgres_container}$"; then
        print_error "PostgreSQL container is not running"
        rm -rf "$backup_path"
        exit 1
    fi

    if ! docker ps --format '{{.Names}}' | grep -q "^${minio_container}$"; then
        print_error "MinIO container is not running"
        rm -rf "$backup_path"
        exit 1
    fi

    # Get version info
    local app_version="unknown"
    if [ -f "$PROJECT_ROOT/package.json" ]; then
        app_version=$(grep -o '"version": *"[^"]*"' "$PROJECT_ROOT/package.json" | head -1 | cut -d'"' -f4)
    fi

    # Get schema version (latest migration name)
    local schema_version=$(docker exec "$postgres_container" psql -U "$db_user" -d "$db_name" -t -c \
        "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1" 2>/dev/null | tr -d ' \n' || echo "unknown")
    local migration_count=$(docker exec "$postgres_container" psql -U "$db_user" -d "$db_name" -t -c \
        "SELECT COUNT(*) FROM _prisma_migrations" 2>/dev/null | tr -d ' \n' || echo "0")

    echo -e "  ${ARROW} Backup components:"
    echo -e "     • PostgreSQL database"
    echo -e "     • MinIO storage (bucket: $minio_bucket)"
    echo -e "     • Environment configuration"
    echo ""

    # 1. Create manifest
    cat > "$backup_path/manifest.json" << EOF
{
    "version": "1.1",
    "app_version": "$app_version",
    "schema_version": "$schema_version",
    "migration_count": $migration_count,
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "hostname": "$(hostname)",
    "components": {
        "database": true,
        "minio": true,
        "env": true
    },
    "minio_bucket": "$minio_bucket",
    "backup_format": "data-only-insert",
    "notes": "Full backup created by install.sh backup-full"
}
EOF

    # 2. Backup PostgreSQL
    start_spinner "Backing up PostgreSQL database..."

    # Use --data-only --column-inserts for schema-change resilient backups
    # - --data-only: Don't dump schema (current migration state is preserved)
    # - --column-inserts: Generate INSERT with column names (tolerant of schema changes)
    # - --disable-triggers: Prevent FK constraint issues during restore
    docker exec "$postgres_container" \
        pg_dump -U "$db_user" -d "$db_name" \
        --data-only \
        --column-inserts \
        --no-owner --no-acl \
        --disable-triggers \
        > "$backup_path/database.sql"

    if [ $? -eq 0 ]; then
        gzip "$backup_path/database.sql"
        stop_spinner true "Database backed up"
    else
        stop_spinner false "Database backup failed"
        rm -rf "$backup_path"
        exit 1
    fi

    # 3. Backup MinIO
    start_spinner "Backing up MinIO storage..."

    # Use docker cp to copy MinIO data
    # MinIO stores data at /data/<bucket>
    docker cp "$minio_container:/data/$minio_bucket" "$backup_path/minio/" 2>/dev/null

    if [ $? -eq 0 ]; then
        local minio_size=$(du -sh "$backup_path/minio" 2>/dev/null | cut -f1)
        stop_spinner true "MinIO backed up ($minio_size)"
    else
        stop_spinner false "MinIO backup failed (bucket may be empty)"
        # Continue anyway - bucket might be empty
        mkdir -p "$backup_path/minio/$minio_bucket"
    fi

    # 4. Backup .env file
    start_spinner "Backing up environment configuration..."

    if [ -f "$ENV_FILE" ]; then
        # Create SHA256 hash for integrity verification
        sha256sum "$ENV_FILE" | awk '{print $1}' > "$backup_path/env.sha256"

        # Copy .env (will be encrypted in the archive if password provided)
        cp "$ENV_FILE" "$backup_path/env.backup"
        stop_spinner true "Environment backed up"
    else
        stop_spinner false ".env file not found"
        echo "" > "$backup_path/env.backup"
    fi

    # 5. Ask for encryption password (optional) - before starting spinner
    echo ""
    echo -e "  ${WARN} The backup contains sensitive data (encryption keys, passwords)."
    read -p "  Encrypt backup with password? (y/N): " -n 1 -r
    echo

    local encrypt_backup=false
    local password=""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -s -p "  Enter encryption password: " password
        echo
        read -s -p "  Confirm password: " password_confirm
        echo

        if [ "$password" != "$password_confirm" ]; then
            print_error "Passwords do not match"
            rm -rf "$backup_path"
            exit 1
        fi
        encrypt_backup=true
    fi

    # 6. Create final archive
    start_spinner "Creating backup archive..."

    # Create tar archive
    cd "$BACKUP_DIR"
    tar -czf "${backup_name}.tar.gz" "$backup_name"

    if [ "$encrypt_backup" = true ]; then
        # Encrypt with openssl
        openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
            -in "${backup_name}.tar.gz" \
            -out "${backup_name}.tar.gz.enc" \
            -pass pass:"$password"

        if [ $? -eq 0 ]; then
            rm "${backup_name}.tar.gz"
            final_archive="${backup_name}.tar.gz.enc"
            stop_spinner true "Encrypted archive created"
        else
            stop_spinner false "Encryption failed"
            rm -rf "$backup_path"
            exit 1
        fi
    else
        stop_spinner true "Archive created"
    fi

    cd "$PROJECT_ROOT"

    # Cleanup temp directory
    rm -rf "$backup_path"

    # Calculate final size
    local final_size=$(ls -lh "$BACKUP_DIR/$final_archive" | awk '{print $5}')

    echo ""
    echo -e "  ${CHECK} ${GREEN}Full backup complete!${NC}"
    echo ""
    echo -e "  ${CHECK} File: ${CYAN}$BACKUP_DIR/$final_archive${NC}"
    echo -e "  ${CHECK} Size: $final_size"
    if [ "$encrypt_backup" = true ]; then
        echo -e "  ${CHECK} Encrypted: Yes (AES-256-CBC)"
    fi
    echo ""
    echo -e "  ${ARROW} Restore with: ${CYAN}./install.sh restore full $BACKUP_DIR/$final_archive${NC}"
    echo ""
}

################################################################################
# Database-only Restore
################################################################################

cmd_restore_db() {
    local backup_file="$1"

    echo ""
    echo -e "${BOLD}Database Restore${NC}"
    echo ""

    if [ -z "$backup_file" ]; then
        print_error "Please specify a backup file"
        echo ""
        echo "Usage: ./install.sh restore db <backup-file.sql.gz>"
        echo ""

        if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
            echo "Available database backups:"
            ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | awk '{print "  " $NF " (" $5 ")"}'
        fi
        exit 1
    fi

    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi

    print_warning "This will REPLACE all data in the production database!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Restore cancelled"
        return
    fi

    load_env

    local postgres_container=$(get_container_name "postgres")
    local db_user="${POSTGRES_USER:-illustboard_user}"
    local db_name="${POSTGRES_DB:-illustboard_db}"

    if ! docker ps --format '{{.Names}}' | grep -q "^${postgres_container}$"; then
        print_error "PostgreSQL container is not running"
        exit 1
    fi

    local backend_container=$(get_container_name "backend")

    start_spinner "Stopping backend..."
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" stop backend 2>/dev/null
    stop_spinner true "Backend stopped"

    # Apply pending migrations (ensures current schema)
    start_spinner "Applying pending migrations..."
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" start backend 2>/dev/null
    sleep 3  # Wait for container to start
    docker exec "$backend_container" sh -c "cd /app/apps/backend && npx prisma migrate deploy" >/dev/null 2>&1
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" stop backend 2>/dev/null
    stop_spinner true "Migrations applied"

    # TRUNCATE existing data (preserving schema and _prisma_migrations)
    start_spinner "Clearing existing data..."
    docker exec -i "$postgres_container" psql -U "$db_user" -d "$db_name" --quiet << 'TRUNCATE_EOF'
SET session_replication_role = 'replica';
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables
              WHERE schemaname = 'public'
              AND tablename != '_prisma_migrations') LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;
SET session_replication_role = 'origin';
TRUNCATE_EOF
    stop_spinner true "Existing data cleared"

    # Create restore log file
    local log_file="$BACKUP_DIR/restore_$(date +%Y%m%d_%H%M%S).log"

    start_spinner "Restoring database..."

    # Restore with error logging (continue on errors for schema differences)
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" | docker exec -i "$postgres_container" \
            psql -U "$db_user" -d "$db_name" \
            --set ON_ERROR_ROLLBACK=on \
            -v ON_ERROR_STOP=off \
            2>&1 | tee "$log_file" | grep -v "^INSERT" >/dev/null
    else
        docker exec -i "$postgres_container" \
            psql -U "$db_user" -d "$db_name" \
            --set ON_ERROR_ROLLBACK=on \
            -v ON_ERROR_STOP=off \
            < "$backup_file" 2>&1 | tee "$log_file" | grep -v "^INSERT" >/dev/null
    fi

    # Check for errors in log
    local error_count=$(grep -c "ERROR:" "$log_file" 2>/dev/null || echo 0)
    if [ "$error_count" -gt 0 ]; then
        stop_spinner true "Database restored with warnings"
        print_warning "Restore completed with $error_count errors (likely schema differences)"
        echo -e "  ${ARROW} See log: ${CYAN}$log_file${NC}"
    else
        stop_spinner true "Database restored"
        rm -f "$log_file"  # Clean up log if no errors
    fi

    start_spinner "Restarting backend..."
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" start backend 2>/dev/null
    stop_spinner true "Backend restarted"

    echo ""
    print_success "Restore complete!"
    echo ""
}

################################################################################
# Full Restore (Database + MinIO + .env)
################################################################################

cmd_restore_full() {
    local backup_file="$1"

    echo ""
    echo -e "${BOLD}Full Instance Restore${NC}"
    echo ""

    if [ -z "$backup_file" ]; then
        print_error "Please specify a backup file"
        echo ""
        echo "Usage: ./install.sh restore full <backup-file.tar.gz>"
        echo ""

        if [ -d "$BACKUP_DIR" ]; then
            echo "Available full backups:"
            ls -lh "$BACKUP_DIR"/backup_*.tar.gz* 2>/dev/null | awk '{print "  " $NF " (" $5 ")"}'
        fi
        exit 1
    fi

    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi

    echo -e "  ${WARN} ${YELLOW}WARNING: This will REPLACE ALL DATA including:${NC}"
    echo -e "     • PostgreSQL database"
    echo -e "     • MinIO storage (all images)"
    echo -e "     • Environment configuration (.env)"
    echo ""
    print_warning "This operation cannot be undone!"
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm
    echo

    if [ "$confirm" != "yes" ]; then
        print_info "Restore cancelled"
        return
    fi

    load_env

    local postgres_container=$(get_container_name "postgres")
    local minio_container=$(get_container_name "minio")
    local db_user="${POSTGRES_USER:-illustboard_user}"
    local db_name="${POSTGRES_DB:-illustboard_db}"

    # Create temp directory for extraction
    local temp_dir=$(mktemp -d)
    local backup_dir=""

    # Handle encrypted backups
    local archive_file="$backup_file"
    if [[ "$backup_file" == *.enc ]]; then
        echo ""
        read -s -p "  Enter decryption password: " password
        echo

        start_spinner "Decrypting backup..."

        openssl enc -aes-256-cbc -d -salt -pbkdf2 -iter 100000 \
            -in "$backup_file" \
            -out "$temp_dir/backup.tar.gz" \
            -pass pass:"$password"

        if [ $? -ne 0 ]; then
            stop_spinner false "Decryption failed (wrong password?)"
            rm -rf "$temp_dir"
            exit 1
        fi

        stop_spinner true "Backup decrypted"
        archive_file="$temp_dir/backup.tar.gz"
    fi

    # Extract archive
    start_spinner "Extracting backup archive..."

    tar -xzf "$archive_file" -C "$temp_dir"

    if [ $? -ne 0 ]; then
        stop_spinner false "Failed to extract archive"
        rm -rf "$temp_dir"
        exit 1
    fi

    stop_spinner true "Archive extracted"

    # Find the backup directory
    backup_dir=$(find "$temp_dir" -maxdepth 1 -type d -name "backup_*" | head -1)

    if [ -z "$backup_dir" ] || [ ! -f "$backup_dir/manifest.json" ]; then
        print_error "Invalid backup format (manifest.json not found)"
        rm -rf "$temp_dir"
        exit 1
    fi

    # Read manifest
    echo ""
    echo -e "  ${ARROW} Backup info:"
    local backup_app_version=$(grep -o '"app_version": *"[^"]*"' "$backup_dir/manifest.json" | cut -d'"' -f4)
    local backup_date=$(grep -o '"created_at": *"[^"]*"' "$backup_dir/manifest.json" | cut -d'"' -f4)
    local backup_bucket=$(grep -o '"minio_bucket": *"[^"]*"' "$backup_dir/manifest.json" | cut -d'"' -f4)
    local backup_schema_version=$(grep -o '"schema_version": *"[^"]*"' "$backup_dir/manifest.json" | cut -d'"' -f4)
    local backup_format=$(grep -o '"backup_format": *"[^"]*"' "$backup_dir/manifest.json" | cut -d'"' -f4)
    echo -e "     • App version: $backup_app_version"
    echo -e "     • Created: $backup_date"
    echo -e "     • MinIO bucket: $backup_bucket"
    if [ -n "$backup_schema_version" ]; then
        echo -e "     • Schema version: $backup_schema_version"
    fi
    if [ -n "$backup_format" ]; then
        echo -e "     • Backup format: $backup_format"
    fi

    # Check schema version compatibility
    local current_schema_version=$(docker exec "$postgres_container" psql -U "$db_user" -d "$db_name" -t -c \
        "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1" 2>/dev/null | tr -d ' \n' || echo "unknown")

    if [ -n "$backup_schema_version" ] && [ "$backup_schema_version" != "$current_schema_version" ]; then
        echo ""
        print_warning "Schema version mismatch detected!"
        echo -e "     • Backup schema: $backup_schema_version"
        echo -e "     • Current schema: $current_schema_version"
        echo -e "     • Migrations will be applied to ensure correct schema."
        echo ""
    fi

    # Warn about old backup format
    if [ -z "$backup_format" ] || [ "$backup_format" != "data-only-insert" ]; then
        echo ""
        print_warning "This backup uses the old COPY format."
        echo -e "     Some data may not restore correctly if schema has changed."
        echo -e "     Consider creating a new backup with the latest install.sh."
        echo ""
    fi
    echo ""

    # Check containers
    if ! docker ps --format '{{.Names}}' | grep -q "^${postgres_container}$"; then
        print_error "PostgreSQL container is not running"
        rm -rf "$temp_dir"
        exit 1
    fi

    if ! docker ps --format '{{.Names}}' | grep -q "^${minio_container}$"; then
        print_error "MinIO container is not running"
        rm -rf "$temp_dir"
        exit 1
    fi

    # Stop services
    start_spinner "Stopping backend and frontend..."
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" stop backend frontend 2>/dev/null
    stop_spinner true "Services stopped"

    # 1. Restore .env file
    if [ -f "$backup_dir/env.backup" ] && [ -s "$backup_dir/env.backup" ]; then
        echo ""
        read -p "  Restore .env file? (y/N): " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            start_spinner "Restoring environment configuration..."

            # Backup current .env
            if [ -f "$ENV_FILE" ]; then
                cp "$ENV_FILE" "${ENV_FILE}.pre-restore.$(date +%Y%m%d_%H%M%S)"
            fi

            cp "$backup_dir/env.backup" "$ENV_FILE"

            # Verify integrity if hash exists
            if [ -f "$backup_dir/env.sha256" ]; then
                local expected_hash=$(cat "$backup_dir/env.sha256")
                local actual_hash=$(sha256sum "$ENV_FILE" | awk '{print $1}')
                if [ "$expected_hash" = "$actual_hash" ]; then
                    stop_spinner true "Environment restored (integrity verified)"
                else
                    stop_spinner true "Environment restored (hash mismatch - may be modified)"
                fi
            else
                stop_spinner true "Environment restored"
            fi

            # Reload env vars
            load_env
        fi
    fi

    # 2. Restore PostgreSQL
    local backend_container=$(get_container_name "backend")

    if [ -f "$backup_dir/database.sql.gz" ]; then
        # Apply pending migrations (ensures current schema)
        start_spinner "Applying pending migrations..."
        docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" start backend 2>/dev/null
        sleep 3  # Wait for container to start
        docker exec "$backend_container" sh -c "cd /app/apps/backend && npx prisma migrate deploy" >/dev/null 2>&1
        docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" stop backend 2>/dev/null
        stop_spinner true "Migrations applied"

        # TRUNCATE existing data (preserving schema and _prisma_migrations)
        start_spinner "Clearing existing data..."
        docker exec -i "$postgres_container" psql -U "$db_user" -d "$db_name" --quiet << 'TRUNCATE_EOF'
SET session_replication_role = 'replica';
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables
              WHERE schemaname = 'public'
              AND tablename != '_prisma_migrations') LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;
SET session_replication_role = 'origin';
TRUNCATE_EOF
        stop_spinner true "Existing data cleared"

        # Create restore log file
        local log_file="$BACKUP_DIR/restore_$(date +%Y%m%d_%H%M%S).log"

        start_spinner "Restoring PostgreSQL database..."

        # Restore with error logging (continue on errors for schema differences)
        gunzip -c "$backup_dir/database.sql.gz" | docker exec -i "$postgres_container" \
            psql -U "$db_user" -d "$db_name" \
            --set ON_ERROR_ROLLBACK=on \
            -v ON_ERROR_STOP=off \
            2>&1 | tee "$log_file" | grep -v "^INSERT" >/dev/null

        # Check for errors in log
        local error_count=$(grep -c "ERROR:" "$log_file" 2>/dev/null || echo 0)
        if [ "$error_count" -gt 0 ]; then
            stop_spinner true "Database restored with warnings"
            print_warning "Restore completed with $error_count errors (likely schema differences)"
            echo -e "  ${ARROW} See log: ${CYAN}$log_file${NC}"
        else
            stop_spinner true "Database restored"
            rm -f "$log_file"  # Clean up log if no errors
        fi
    else
        print_warning "Database backup not found in archive"
    fi

    # 3. Restore MinIO
    local minio_bucket="${S3_BUCKET:-illustboard}"
    if [ -d "$backup_dir/minio/$backup_bucket" ]; then
        start_spinner "Restoring MinIO storage..."

        # Clear existing bucket data
        docker exec "$minio_container" rm -rf "/data/$minio_bucket" 2>/dev/null

        # Copy restored data
        docker cp "$backup_dir/minio/$backup_bucket" "$minio_container:/data/$minio_bucket"

        if [ $? -eq 0 ]; then
            local restored_size=$(du -sh "$backup_dir/minio/$backup_bucket" 2>/dev/null | cut -f1)
            stop_spinner true "MinIO restored ($restored_size)"
        else
            stop_spinner false "MinIO restore failed"
        fi
    else
        print_info "No MinIO data in backup"
    fi

    # Restart services
    start_spinner "Restarting services..."
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" start backend frontend 2>/dev/null
    stop_spinner true "Services restarted"

    # Cleanup
    rm -rf "$temp_dir"

    echo ""
    print_success "Full restore complete!"
    echo ""
    echo -e "  ${WARN} Please verify the application is working correctly."
    echo -e "  ${WARN} If you restored .env, you may need to restart Docker Compose:"
    echo -e "     ${CYAN}./install.sh restart${NC}"
    echo ""
}

################################################################################
# List Backups
################################################################################

cmd_backup_list() {
    echo ""
    echo -e "${BOLD}Available Backups${NC}"
    echo ""

    if [ ! -d "$BACKUP_DIR" ]; then
        print_info "No backups found"
        echo ""
        return
    fi

    # Full backups
    local full_backups=$(ls -1 "$BACKUP_DIR"/backup_*.tar.gz* 2>/dev/null | wc -l)
    if [ "$full_backups" -gt 0 ]; then
        echo -e "  ${CYAN}Full Backups:${NC}"
        ls -lh "$BACKUP_DIR"/backup_*.tar.gz* 2>/dev/null | while read line; do
            local file=$(echo "$line" | awk '{print $NF}')
            local size=$(echo "$line" | awk '{print $5}')
            local date=$(echo "$line" | awk '{print $6, $7, $8}')
            local basename=$(basename "$file")

            # Check if encrypted
            if [[ "$file" == *.enc ]]; then
                echo -e "     ${CHECK} $basename ($size, $date) ${YELLOW}[encrypted]${NC}"
            else
                echo -e "     ${CHECK} $basename ($size, $date)"
            fi
        done
        echo ""
    fi

    # Database-only backups
    local db_backups=$(ls -1 "$BACKUP_DIR"/db_backup_*.sql.gz 2>/dev/null | wc -l)
    local legacy_backups=$(ls -1 "$BACKUP_DIR"/illustboard_backup_*.sql.gz 2>/dev/null | wc -l)
    local total_db=$((db_backups + legacy_backups))

    if [ "$total_db" -gt 0 ]; then
        echo -e "  ${CYAN}Database-only Backups:${NC}"
        ls -lh "$BACKUP_DIR"/*_backup_*.sql.gz 2>/dev/null | while read line; do
            local file=$(echo "$line" | awk '{print $NF}')
            local size=$(echo "$line" | awk '{print $5}')
            local date=$(echo "$line" | awk '{print $6, $7, $8}')
            local basename=$(basename "$file")
            echo -e "     ${CHECK} $basename ($size, $date)"
        done
        echo ""
    fi

    if [ "$full_backups" -eq 0 ] && [ "$total_db" -eq 0 ]; then
        print_info "No backups found in $BACKUP_DIR"
    fi

    echo ""
}
