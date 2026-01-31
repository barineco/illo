# docker.sh - Docker and dependency check functions
# This file is sourced by install.sh - do not execute directly

################################################################################
# Docker Compose Profile Management
################################################################################

# Build Docker Compose profiles based on environment configuration
# Returns the profiles string via stdout
get_compose_profiles() {
    local profiles=""

    # Determine nginx mode: ssl or http
    # SSL mode: direct HTTPS exposure (ports 80/443)
    # HTTP mode: for CFT or development (NGINX_PORT only)
    if [ "$SSL_ENABLED" = "true" ]; then
        profiles="--profile ssl"
    else
        profiles="--profile http"
        # Add cloudflare profile if tunnel is enabled (requires http profile)
        if [ "$CLOUDFLARE_TUNNEL_ENABLED" = "true" ] && [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
            profiles="$profiles --profile cloudflare"
        fi
    fi

    # Add MinIO console if enabled
    if [ "$EXPOSE_MINIO_CONSOLE" = "true" ]; then
        profiles="$profiles --profile minio-console"
    fi

    echo "$profiles"
}

################################################################################
# Port and Container Utilities
################################################################################

is_port_in_use() {
    lsof -i ":$1" -sTCP:LISTEN -t > /dev/null 2>&1
}

get_container_name() {
    local service="$1"
    case "$service" in
        postgres|db|database) echo "${APP_NAME}-postgres" ;;
        redis|cache) echo "${APP_NAME}-redis" ;;
        minio|s3|storage) echo "${APP_NAME}-minio" ;;
        minio-console) echo "${APP_NAME}-minio-console" ;;
        backend|api) echo "${APP_NAME}-backend" ;;
        frontend|web) echo "${APP_NAME}-frontend" ;;
        nginx|proxy|nginx-internal) echo "${APP_NAME}-nginx" ;;
        cloudflared|tunnel|cf) echo "${APP_NAME}-cloudflared" ;;
        *) echo "" ;;
    esac
}

################################################################################
# Dependency Checking
################################################################################

check_dependencies() {
    local has_errors=false

    step "Checking dependencies..."

    # Check Docker
    if command -v docker &> /dev/null; then
        local docker_version=$(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        step_done "Docker: v$docker_version"
    else
        step_fail "Docker is not installed"
        echo -e "     ${DIM}Install from: https://docs.docker.com/get-docker/${NC}"
        has_errors=true
    fi

    # Check Docker daemon is running
    if docker info &> /dev/null; then
        step_done "Docker daemon: running"
    else
        step_fail "Docker daemon is not running"
        echo -e "     ${DIM}Start Docker Desktop or run: sudo systemctl start docker${NC}"
        has_errors=true
    fi

    # Check Docker Compose
    if docker compose version &> /dev/null; then
        local compose_version=$(docker compose version --short 2>/dev/null)
        step_done "Docker Compose: v$compose_version"
    elif docker-compose version &> /dev/null; then
        local compose_version=$(docker-compose version --short 2>/dev/null)
        step_done "Docker Compose (legacy): v$compose_version"
    else
        step_fail "Docker Compose is not installed"
        echo -e "     ${DIM}Install from: https://docs.docker.com/compose/install/${NC}"
        has_errors=true
    fi

    # Check Node.js (for key generation)
    if command -v node &> /dev/null; then
        local node_version=$(node --version 2>/dev/null)
        step_done "Node.js: $node_version"
    else
        step_fail "Node.js is not installed (required for key generation)"
        echo -e "     ${DIM}Install from: https://nodejs.org/${NC}"
        has_errors=true
    fi

    # Check available disk space (warn if < 5GB)
    local available_space=$(df -BG "$PROJECT_ROOT" 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G')
    if [ -n "$available_space" ] && [ "$available_space" -lt 5 ]; then
        step_warn "Low disk space: ${available_space}GB available (recommend 5GB+)"
    else
        step_done "Disk space: ${available_space}GB available"
    fi

    # Check required files
    if [ -f "$COMPOSE_FILE" ]; then
        step_done "docker-compose.prod.yml: found"
    else
        step_fail "docker-compose.prod.yml not found"
        has_errors=true
    fi

    if [ "$has_errors" = true ]; then
        echo ""
        print_error "Some dependencies are missing. Please install them and try again."
        exit 1
    fi

    echo ""
}
