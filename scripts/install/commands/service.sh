# service.sh - Service management commands (start, stop, restart, rebuild)
# This file is sourced by install.sh - do not execute directly

cmd_start() {
    check_env_file

    echo ""
    echo -e "${BOLD}Starting Production Services${NC}"
    echo ""

    start_steps 5

    # Step 1: Validate environment
    step "Validating environment..."
    load_env

    local required_vars=("JWT_SECRET" "ENCRYPTION_KEY" "BASE_URL")
    local missing_vars=()

    for var in "${required_vars[@]}"; do
        local value="${!var}"
        if [ -z "$value" ] || [[ "$value" == *"CHANGE"* ]]; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -gt 0 ]; then
        step_fail "Missing required variables: ${missing_vars[*]}"
        print_info "Please update $ENV_FILE and try again."
        exit 1
    fi
    step_done "Environment validated"

    # Step 2: Check Docker
    step "Checking Docker..."
    if ! docker info &> /dev/null; then
        step_fail "Docker is not running"
        exit 1
    fi
    step_done "Docker is ready"

    # Step 3: Determine profiles to use
    step "Configuring deployment mode..."
    local profiles=$(get_compose_profiles)
    local services=("postgres" "redis" "minio" "backend" "frontend")

    if [ "$SSL_ENABLED" = "true" ]; then
        # SSL mode: nginx-ssl with HTTPS on 443
        services+=("nginx-ssl")

        # Verify SSL certificates exist
        if [ ! -f "$PROJECT_ROOT/ssl/cert.pem" ] || [ ! -f "$PROJECT_ROOT/ssl/key.pem" ]; then
            step_fail "SSL certificates not found"
            echo ""
            print_error "SSL_ENABLED=true but certificates are missing."
            echo -e "  ${ARROW} Create directory: ${CYAN}mkdir -p ssl${NC}"
            echo -e "  ${ARROW} Place certificate: ${CYAN}ssl/cert.pem${NC}"
            echo -e "  ${ARROW} Place private key: ${CYAN}ssl/key.pem${NC}"
            echo ""
            print_info "For Cloudflare Origin Certificate:"
            echo -e "  1. Cloudflare Dashboard > SSL/TLS > Origin Server"
            echo -e "  2. Create Certificate (15 years validity)"
            echo -e "  3. Save certificate as ssl/cert.pem"
            echo -e "  4. Save private key as ssl/key.pem"
            exit 1
        fi
        step_done "SSL mode (HTTPS on port 443)"
    else
        # HTTP mode
        services+=("nginx")

        if [ "$CLOUDFLARE_TUNNEL_ENABLED" = "true" ] && [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
            # Cloudflare Tunnel mode: nginx + cloudflared
            services+=("cloudflared")
            step_done "Cloudflare Tunnel mode"
        else
            # Direct HTTP exposure mode
            step_done "HTTP mode (port ${NGINX_PORT:-3000})"
        fi
    fi

    # Add MinIO console if enabled
    if [ "$EXPOSE_MINIO_CONSOLE" = "true" ]; then
        services+=("minio-console")
    fi

    # Step 4: Pull images
    step "Pulling Docker images..."
    start_spinner "Pulling images (this may take a while)..."

    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $profiles pull --quiet 2>/dev/null || true

    stop_spinner true "Images ready"

    # Step 5: Start services
    step "Starting services..."
    echo ""

    local total=${#services[@]}
    local current=0

    # Start in detached mode with progress tracking
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $profiles up -d 2>&1 | while read line; do
        if [[ "$line" == *"Started"* ]] || [[ "$line" == *"Running"* ]]; then
            current=$((current + 1))
            progress_bar $current $total
        fi
    done

    echo ""
    echo ""

    # Wait for services to be healthy
    start_spinner "Waiting for services to be healthy..."
    sleep 5

    local all_healthy=true
    for service in "postgres" "redis" "minio"; do
        local container=$(get_container_name "$service")
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "running")
            if [ "$health" != "healthy" ] && [ "$health" != "running" ]; then
                all_healthy=false
            fi
        fi
    done

    if [ "$all_healthy" = true ]; then
        stop_spinner true "All services healthy"
    else
        stop_spinner false "Some services may still be starting"
    fi

    echo ""
    print_success "Production services started!"
    echo ""

    # Show status summary
    cmd_status_brief
}

cmd_stop() {
    echo ""
    echo -e "${BOLD}Stopping Production Services${NC}"
    echo ""

    check_env_file

    # Use all profiles to ensure all containers are stopped (including ssl, http, cloudflared, minio-console)
    local all_profiles="--profile ssl --profile http --profile cloudflare --profile minio-console"

    start_spinner "Stopping all containers..."
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $all_profiles down --remove-orphans 2>/dev/null
    stop_spinner true "All services stopped"

    echo ""
}

cmd_restart() {
    local service=""
    local force_recreate=""

    # Parse arguments
    for arg in "$@"; do
        case "$arg" in
            --force)
                force_recreate="--force-recreate"
                ;;
            *)
                if [ -z "$service" ]; then
                    service="$arg"
                fi
                ;;
        esac
    done

    echo ""
    echo -e "${BOLD}Restarting Services${NC}"
    echo ""

    check_env_file
    load_env
    local profiles=$(get_compose_profiles)
    local all_profiles="--profile ssl --profile http --profile cloudflare --profile minio-console"

    if [ -n "$service" ]; then
        start_spinner "Restarting $service..."
        # Use up -d instead of restart to reload images
        docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $profiles up -d $force_recreate "$service" 2>/dev/null
        stop_spinner true "$service restarted"
    else
        # For full restart, use down + up to ensure profile services are properly handled
        start_spinner "Stopping services..."
        docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $all_profiles down --remove-orphans 2>/dev/null
        stop_spinner true "Services stopped"

        start_spinner "Starting services..."
        docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $profiles up -d --force-recreate 2>/dev/null
        stop_spinner true "All services restarted"
    fi

    echo ""
}

cmd_rebuild() {
    local no_cache=""
    local do_pull=""
    local auto_restart=false
    local services=()

    for arg in "$@"; do
        case "$arg" in
            --no-cache)
                no_cache="--no-cache"
                ;;
            --pull)
                do_pull="--pull"
                ;;
            --restart)
                auto_restart=true
                ;;
            *)
                # Treat non-flag arguments as service names
                services+=("$arg")
                ;;
        esac
    done

    check_env_file

    echo ""
    echo -e "${BOLD}Rebuilding Docker Images${NC}"
    echo ""

    if [ -n "$no_cache" ]; then
        print_warning "Building without cache (this will take longer)"
    fi

    if [ -n "$do_pull" ]; then
        print_info "Pulling latest base images"
    fi

    if [ ${#services[@]} -gt 0 ]; then
        print_info "Services: ${services[*]}"
        docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build $no_cache $do_pull "${services[@]}"
    else
        docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build $no_cache $do_pull
    fi

    echo ""
    print_success "Build complete"

    if [ "$auto_restart" = true ]; then
        echo ""
        cmd_restart --force
    else
        echo ""
        echo -e "  ${ARROW} Apply changes: ${CYAN}./install.sh restart${NC}"
        echo -e "  ${ARROW} Or rebuild and restart: ${CYAN}./install.sh rebuild --restart${NC}"
        echo ""
    fi
}

################################################################################
# Clean command - Remove containers, volumes, and images
################################################################################

cmd_clean() {
    local clean_volumes=false
    local clean_images=false

    for arg in "$@"; do
        case "$arg" in
            --volumes|-v)
                clean_volumes=true
                ;;
            --images|-i)
                clean_images=true
                ;;
            --all|-a)
                clean_volumes=true
                clean_images=true
                ;;
        esac
    done

    echo ""
    echo -e "${BOLD}Cleaning Up Resources${NC}"
    echo ""

    check_env_file
    load_env
    local all_profiles="--profile ssl --profile http --profile cloudflare --profile minio-console"

    # 1. Stop and remove all containers
    start_spinner "Stopping and removing containers..."
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $all_profiles down --remove-orphans 2>/dev/null || true
    stop_spinner true "Containers removed"

    # 2. Remove orphaned containers (filter by project name)
    start_spinner "Removing orphaned containers..."
    docker ps -aq --filter "name=${APP_NAME}-" 2>/dev/null | xargs -r docker rm -f 2>/dev/null || true
    stop_spinner true "Orphaned containers removed"

    # 3. Remove volumes if requested
    if [ "$clean_volumes" = true ]; then
        echo ""
        print_warning "This will delete all data (database, uploads, cache)!"
        echo -n "Are you sure? (y/N): "
        read -r confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            start_spinner "Removing volumes..."
            docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v 2>/dev/null || true
            stop_spinner true "Volumes removed"
        else
            print_info "Skipped volume deletion"
        fi
    fi

    # 4. Remove images if requested
    if [ "$clean_images" = true ]; then
        start_spinner "Removing project images..."
        docker images --filter "reference=${COMPOSE_PROJECT}*" -q 2>/dev/null | xargs -r docker rmi -f 2>/dev/null || true
        docker images --filter "reference=*${APP_NAME}*" -q 2>/dev/null | xargs -r docker rmi -f 2>/dev/null || true
        stop_spinner true "Images removed"
    fi

    # 5. Clean up networks
    start_spinner "Cleaning up networks..."
    docker network prune -f 2>/dev/null || true
    stop_spinner true "Networks cleaned"

    echo ""
    print_success "Cleanup complete"
    echo ""
}

################################################################################
# Reset command - Complete environment reset
################################################################################

cmd_reset() {
    echo ""
    echo -e "${BOLD}${RED}Complete Environment Reset${NC}"
    echo ""

    print_warning "This will:"
    echo "  - Stop all containers"
    echo "  - Delete all volumes (database, uploads, cache)"
    echo "  - Delete all built images"
    echo "  - Regenerate JWK (Bluesky OAuth sessions will be invalidated)"
    echo ""

    echo -n "Type 'RESET' to confirm: "
    read -r confirm
    if [ "$confirm" != "RESET" ]; then
        print_info "Reset cancelled"
        return 0
    fi

    echo ""

    # Clean up everything (volumes + images) without confirmation
    check_env_file
    load_env
    local all_profiles="--profile ssl --profile http --profile cloudflare --profile minio-console"

    start_spinner "Stopping and removing containers..."
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $all_profiles down --remove-orphans 2>/dev/null || true
    stop_spinner true "Containers removed"

    start_spinner "Removing orphaned containers..."
    docker ps -aq --filter "name=${APP_NAME}-" 2>/dev/null | xargs -r docker rm -f 2>/dev/null || true
    stop_spinner true "Orphaned containers removed"

    start_spinner "Removing volumes..."
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v 2>/dev/null || true
    stop_spinner true "Volumes removed"

    start_spinner "Removing project images..."
    docker images --filter "reference=${COMPOSE_PROJECT}*" -q 2>/dev/null | xargs -r docker rmi -f 2>/dev/null || true
    docker images --filter "reference=*${APP_NAME}*" -q 2>/dev/null | xargs -r docker rmi -f 2>/dev/null || true
    stop_spinner true "Images removed"

    start_spinner "Cleaning up networks..."
    docker network prune -f 2>/dev/null || true
    stop_spinner true "Networks cleaned"

    # Regenerate JWK
    echo ""
    cmd_regenerate_jwk --yes

    echo ""
    print_success "Environment reset complete"
    echo ""
    echo -e "  ${ARROW} To start fresh: ${CYAN}./install.sh rebuild && ./install.sh start${NC}"
    echo ""
}

################################################################################
# Update command - Safe production update
################################################################################

cmd_update() {
    echo ""
    echo -e "${BOLD}Updating Production Environment${NC}"
    echo ""

    check_env_file
    load_env

    # Step 1: Recommend backup
    print_info "Step 1/6: Backup recommendation"
    echo ""
    echo -e "  ${WARN} It's recommended to backup before updating."
    echo -e "  ${ARROW} Run: ${CYAN}./install.sh backup db${NC}   (database only)"
    echo -e "  ${ARROW} Run: ${CYAN}./install.sh backup full${NC} (full backup with MinIO)"
    echo ""
    echo -n "Run backup now? [d]b / [f]ull / [s]kip (default: skip): "
    read -r backup_choice
    case "$backup_choice" in
        d|D|db)
            cmd_backup_db
            echo ""
            ;;
        f|F|full)
            cmd_backup_full
            echo ""
            ;;
        *)
            print_info "Skipping backup. You can run it manually later."
            echo ""
            ;;
    esac

    # Step 2: Check for pending migrations (pre-update verification)
    print_info "Step 2/6: Checking migration status..."
    local backend_container=$(get_container_name "backend")
    if docker ps --format '{{.Names}}' | grep -q "^${backend_container}$"; then
        local migration_output=$(docker exec "$backend_container" sh -c "cd /app/apps/backend && npx prisma migrate status" 2>&1 || true)
        echo "$migration_output"

        if echo "$migration_output" | grep -qi "pending\|not yet applied"; then
            echo ""
            print_warning "Pending migrations detected. These will be applied during the update."
        fi
        echo ""
    else
        echo -e "${DIM}Backend not running, skipping migration check.${NC}"
        echo ""
    fi

    # Step 3: Sync .env with .env.example
    print_info "Step 3/6: Syncing environment variables..."
    if _fix_env_silent; then
        step_done "Environment file synchronized with template"
    else
        print_warning "Could not sync environment file (will continue anyway)"
    fi
    # Reload env after fix
    load_env
    echo ""

    # Step 4: Validate environment configuration
    print_info "Step 4/6: Validating environment configuration..."
    echo ""
    _validate_env
    local env_status=$?

    if [ $env_status -eq 2 ]; then
        # Has errors - must run setup-env
        echo ""
        print_error "Environment configuration has errors."
        print_info "Run './install.sh setup-env' to fix configuration, then run update again."
        echo ""
        echo -n "Run setup-env now? (Y/n): "
        read -r run_setup
        if [ "$run_setup" != "n" ] && [ "$run_setup" != "N" ]; then
            cmd_setup_env
            # Re-sync after setup-env (setup-env may add variables to end of file)
            print_info "Re-syncing environment file..."
            _fix_env_silent
            load_env
            echo ""
            # Re-validate
            print_info "Re-validating configuration..."
            echo ""
            _validate_env
            env_status=$?
            if [ $env_status -eq 2 ]; then
                print_error "Configuration still has errors. Please fix manually and try again."
                exit 1
            fi
        else
            print_error "Cannot continue with invalid configuration."
            exit 1
        fi
    elif [ $env_status -eq 1 ]; then
        # Has warnings - continue with confirmation
        echo ""
        echo -n "Continue with warnings? (Y/n): "
        read -r continue_with_warnings
        if [ "$continue_with_warnings" = "n" ] || [ "$continue_with_warnings" = "N" ]; then
            print_info "Update cancelled. Run './install.sh setup-env' to fix warnings."
            exit 0
        fi
    fi
    echo ""

    # Step 5: Build new images (no cache for reliability)
    print_info "Step 5/6: Building new images (--no-cache --pull)..."
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache --pull

    # Step 6: Recreate services with force-recreate
    print_info "Step 6/6: Restarting services..."
    local profiles=$(get_compose_profiles)
    local all_profiles="--profile ssl --profile http --profile cloudflare --profile minio-console"

    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $all_profiles down --remove-orphans 2>/dev/null || true
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $profiles up -d --force-recreate

    # Wait for services to be healthy
    start_spinner "Waiting for services to be healthy..."
    sleep 10
    stop_spinner true "Services ready"

    # Verify migration status after update
    echo ""
    print_info "Verifying migration status after update..."
    sleep 5  # Give backend time to run migrations

    backend_container=$(get_container_name "backend")
    if docker ps --format '{{.Names}}' | grep -q "^${backend_container}$"; then
        local post_migration_output=$(docker exec "$backend_container" sh -c "cd /app/apps/backend && npx prisma migrate status" 2>&1 || true)

        if echo "$post_migration_output" | grep -qi "pending\|failed\|not yet applied"; then
            echo ""
            print_warning "Migration verification:"
            echo "$post_migration_output"
            echo ""
            print_warning "Some migrations may not have been applied successfully."
            print_warning "Check backend logs with: ./install.sh logs backend"
        else
            print_success "All migrations applied successfully"
        fi
    fi

    echo ""
    print_success "Update complete!"
    echo ""
    cmd_status_brief
}
