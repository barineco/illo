#!/usr/bin/env bash

################################################################################
# local-dev - Hybrid Development Environment Manager
#
# Architecture:
#   - Infrastructure: Docker Compose (PostgreSQL, Redis, MinIO, MailHog)
#   - Backend: Native localhost process (pnpm dev, port 11104)
#   - Frontend: Native localhost process (pnpm dev, port 11103)
#
# Usage:
#   ./dev/local-dev.sh start         Start infrastructure + frontend/backend
#   ./dev/local-dev.sh stop          Stop all services
#   ./dev/local-dev.sh restart       Restart all services
#   ./dev/local-dev.sh logs [service] Show logs
#   ./dev/local-dev.sh status        Check status
#   ./dev/local-dev.sh reset         Reset and restart
#   ./dev/local-dev.sh cleanup       Force cleanup all dev processes
################################################################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# PID files
PID_DIR="/tmp/illo-dev"
FRONTEND_PID="$PID_DIR/frontend.pid"
BACKEND_PID="$PID_DIR/backend.pid"

# Log files
LOG_DIR="$PROJECT_ROOT/logs"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_LOG="$LOG_DIR/backend.log"

################################################################################
# Helper Functions
################################################################################

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create necessary directories
setup_directories() {
    mkdir -p "$PID_DIR"
    mkdir -p "$LOG_DIR"
}

# Check if process is running
is_process_running() {
    local pid_file="$1"
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Check if port is in use
is_port_in_use() {
    lsof -i ":$1" > /dev/null 2>&1
}

# Kill process tree recursively (kills children first, then parent)
kill_process_tree() {
    local pid=$1
    local signal=${2:-TERM}

    # Get all child processes
    local children=$(pgrep -P "$pid" 2>/dev/null || true)

    # Kill children first (recursive)
    for child in $children; do
        kill_process_tree "$child" "$signal"
    done

    # Then kill the parent
    kill -"$signal" "$pid" 2>/dev/null || true
}

# Get all PIDs listening on a port
get_pids_on_port() {
    local port=$1
    lsof -ti :"$port" 2>/dev/null || true
}

# Force cleanup all development processes
cleanup_dev_processes() {
    print_info "Cleaning up all development processes..."

    # 1. PID file-based cleanup with process tree termination
    for pid_file in "$BACKEND_PID" "$FRONTEND_PID"; do
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file" 2>/dev/null || true)
            if [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
                print_info "Terminating process tree from PID file: $pid"
                kill_process_tree "$pid" TERM
            fi
            rm -f "$pid_file"
        fi
    done

    # 2. Port-based cleanup with process tree termination
    for port in 11103 11104; do
        local pids=$(get_pids_on_port "$port")
        for pid in $pids; do
            if [ -n "$pid" ]; then
                print_info "Terminating process tree on port $port: PID $pid"
                kill_process_tree "$pid" TERM
            fi
        done
    done

    # 3. Wait for graceful termination
    sleep 2

    # 4. Force kill any remaining processes on ports
    for port in 11103 11104; do
        local pids=$(get_pids_on_port "$port")
        if [ -n "$pids" ]; then
            print_warning "Force killing remaining processes on port $port..."
            for pid in $pids; do
                kill -9 "$pid" 2>/dev/null || true
            done
        fi
    done

    # 5. Final wait
    sleep 1

    # 6. Verify cleanup
    local remaining_11103=$(get_pids_on_port 11103)
    local remaining_11104=$(get_pids_on_port 11104)

    if [ -z "$remaining_11103" ] && [ -z "$remaining_11104" ]; then
        print_success "Cleanup completed - all dev processes terminated"
    else
        print_warning "Some processes may still be running. Manual intervention may be required."
        [ -n "$remaining_11103" ] && print_warning "  Port 11103: PIDs $remaining_11103"
        [ -n "$remaining_11104" ] && print_warning "  Port 11104: PIDs $remaining_11104"
    fi
}

################################################################################
# Docker Infrastructure Management
################################################################################

start_infrastructure() {
    print_info "Starting infrastructure (Docker)..."
    docker compose -p illo-localdev -f dev/docker compose.local-dev.yml up -d

    print_info "Waiting for services to be ready..."
    sleep 5

    docker compose -p illo-localdev -f dev/docker compose.local-dev.yml ps
}

stop_infrastructure() {
    print_info "Stopping infrastructure (Docker)..."
    docker compose -p illo-localdev -f dev/docker compose.local-dev.yml down
}

################################################################################
# Frontend/Backend Process Management
################################################################################

run_prisma_migrations() {
    print_info "Running Prisma migrations and generating client..."
    cd "$PROJECT_ROOT/apps/backend"

    # Generate Prisma client first (in case schema was updated without migration)
    print_info "Generating Prisma client..."
    DATABASE_URL="postgresql://illustboard_user:illustboard_pass@localhost:5432/illustboard_db" \
        npx prisma generate --schema prisma/schema.prisma

    if [ $? -ne 0 ]; then
        print_error "Prisma client generation failed"
        cd "$PROJECT_ROOT"
        return 1
    fi

    # Run migrations
    print_info "Applying database migrations..."
    DATABASE_URL="postgresql://illustboard_user:illustboard_pass@localhost:5432/illustboard_db" \
        npx prisma migrate deploy --schema prisma/schema.prisma

    if [ $? -ne 0 ]; then
        print_error "Prisma migrations failed"
        cd "$PROJECT_ROOT"
        return 1
    fi

    print_success "Prisma migrations and client generation completed"
    cd "$PROJECT_ROOT"
}

start_backend() {
    if is_process_running "$BACKEND_PID"; then
        print_warning "Backend is already running"
        return
    fi

    # Run migrations before starting backend
    run_prisma_migrations || return 1

    print_info "Starting backend (localhost:11104)..."
    cd "$PROJECT_ROOT/apps/backend"

    # Export environment variables for backend (using defaults or dev/.env.local-dev if exists)
    export DATABASE_URL="${DATABASE_URL:-postgresql://illustboard_user:illustboard_pass@localhost:5432/illustboard_db}"
    export REDIS_HOST="${REDIS_HOST:-localhost}"
    export REDIS_PORT="${REDIS_PORT:-6379}"
    export MINIO_ENDPOINT="${MINIO_ENDPOINT:-localhost}"
    export MINIO_PORT="${MINIO_PORT:-9000}"
    export MINIO_USE_SSL="${MINIO_USE_SSL:-false}"
    export MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
    export MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin}"
    export MINIO_BUCKET="${MINIO_BUCKET:-illustboard}"
    export MINIO_PUBLIC_URL="${MINIO_PUBLIC_URL:-http://localhost:9000}"
    export BASE_URL="${BASE_URL:-http://localhost:11104}"
    export FRONTEND_URL="${FRONTEND_URL:-http://localhost:11103}"
    export PORT="${PORT:-11104}"
    export NODE_ENV="${NODE_ENV:-development}"
    export SMTP_HOST="${SMTP_HOST:-mailhog-localdev}"
    export SMTP_PORT="${SMTP_PORT:-1025}"
    export SMTP_SECURE="${SMTP_SECURE:-false}"
    export MAIL_FROM="${MAIL_FROM:-noreply@localhost}"
    export JWT_SECRET="${JWT_SECRET:-dev_local_secret_change_in_production}"
    export JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-7d}"
    export ENCRYPTION_KEY="${ENCRYPTION_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
    export IMAGE_ENCRYPTION_KEY="${IMAGE_ENCRYPTION_KEY:-fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210}"
    export MESSAGE_ENCRYPTION_KEY="${MESSAGE_ENCRYPTION_KEY:-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef}"
    export IMAGE_SIGNING_KEY="${IMAGE_SIGNING_KEY:-abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd}"
    export IMAGE_SIGNED_URL_ENABLED="${IMAGE_SIGNED_URL_ENABLED:-true}"
    export IMAGE_SIGNED_URL_EXPIRES="${IMAGE_SIGNED_URL_EXPIRES:-30}"
    export IMAGE_HOTLINK_PROTECTION="${IMAGE_HOTLINK_PROTECTION:-false}"
    export IMAGE_ALLOW_NO_REFERER="${IMAGE_ALLOW_NO_REFERER:-true}"
    # Image Processing
    export IMAGE_MAX_FILE_SIZE_MB="${IMAGE_MAX_FILE_SIZE_MB:-32}"
    export IMAGE_MAX_TOTAL_SIZE_MB="${IMAGE_MAX_TOTAL_SIZE_MB:-200}"
    export IMAGE_MAX_FILES_PER_ARTWORK="${IMAGE_MAX_FILES_PER_ARTWORK:-20}"
    export IMAGE_DEFAULT_MAX_WIDTH="${IMAGE_DEFAULT_MAX_WIDTH:-2048}"
    export IMAGE_PRESERVE_FORMAT="${IMAGE_PRESERVE_FORMAT:-true}"
    export IMAGE_EMBED_METADATA="${IMAGE_EMBED_METADATA:-true}"
    export IMAGE_SUPPORT_SVG="${IMAGE_SUPPORT_SVG:-true}"
    # Storage Quota
    export STORAGE_QUOTA_DEFAULT_GB="${STORAGE_QUOTA_DEFAULT_GB:-1}"
    export STORAGE_QUOTA_ADMIN_GB="${STORAGE_QUOTA_ADMIN_GB:-10}"
    export STORAGE_QUOTA_ENFORCE="${STORAGE_QUOTA_ENFORCE:-false}"
    export INSTANCE_ID="${INSTANCE_ID:-localdev}"
    # Patreon OAuth (optional - leave empty for development without Patreon)
    export PATREON_CLIENT_ID="${PATREON_CLIENT_ID:-}"
    export PATREON_CLIENT_SECRET="${PATREON_CLIENT_SECRET:-}"
    export PATREON_REDIRECT_URI="${PATREON_REDIRECT_URI:-http://localhost:11103/settings/patreon/callback}"
    export PATREON_CREATOR_ACCESS_TOKEN="${PATREON_CREATOR_ACCESS_TOKEN:-}"
    # Instance Contact Information
    export INSTANCE_CONTACT_INFO="${INSTANCE_CONTACT_INFO:-admin@localhost}"
    export INSTANCE_ADMIN_USERNAME="${INSTANCE_ADMIN_USERNAME:-}"
    # Rate Limiting (Anti-Scraping)
    export RATE_LIMIT_MEASUREMENT_MODE="${RATE_LIMIT_MEASUREMENT_MODE:-false}"
    export RATE_LIMIT_USE_COMPOSITE_SCORE="${RATE_LIMIT_USE_COMPOSITE_SCORE:-false}"
    export RATE_LIMIT_HARD_SCORE="${RATE_LIMIT_HARD_SCORE:-90}"
    export RATE_LIMIT_SOFT_SCORE="${RATE_LIMIT_SOFT_SCORE:-50}"
    export RATE_LIMIT_WARNING_SCORE="${RATE_LIMIT_WARNING_SCORE:-35}"

    # Headless Browser Detection
    export HEADLESS_DETECTION_ENABLED="${HEADLESS_DETECTION_ENABLED:-true}"
    export HEADLESS_DETECTION_MEASUREMENT_MODE="${HEADLESS_DETECTION_MEASUREMENT_MODE:-true}"
    export HEADLESS_DETECTION_SUSPICIOUS_THRESHOLD="${HEADLESS_DETECTION_SUSPICIOUS_THRESHOLD:-31}"
    export HEADLESS_DETECTION_LIKELY_BOT_THRESHOLD="${HEADLESS_DETECTION_LIKELY_BOT_THRESHOLD:-51}"
    export HEADLESS_DETECTION_DEFINITE_BOT_THRESHOLD="${HEADLESS_DETECTION_DEFINITE_BOT_THRESHOLD:-76}"
    export HEADLESS_DETECTION_INTERACTION_SECRET="${HEADLESS_DETECTION_INTERACTION_SECRET:-dev-secret-change-in-production}"

    nohup pnpm dev > "$BACKEND_LOG" 2>&1 &
    echo $! > "$BACKEND_PID"
    cd "$PROJECT_ROOT"

    # Wait for backend to start, checking for errors in logs
    print_info "Waiting for backend to start..."
    local max_wait=30
    local count=0
    while ! is_port_in_use 11104; do
        sleep 1
        count=$((count + 1))

        # Check if process is still running
        if ! is_process_running "$BACKEND_PID"; then
            print_error "Backend process exited unexpectedly"
            print_error "Last 20 lines of backend log:"
            tail -20 "$BACKEND_LOG" 2>/dev/null || true
            return 1
        fi

        # Check for TypeScript compilation errors in log (only if > 0 errors)
        if [ -f "$BACKEND_LOG" ]; then
            # Match "Found X error" where X > 0
            if grep -qE "Found [1-9][0-9]* error" "$BACKEND_LOG" 2>/dev/null; then
                local error_count=$(grep -oE "Found [1-9][0-9]* error" "$BACKEND_LOG" | tail -1)
                print_error "TypeScript compilation failed: $error_count(s)"
                print_error "Showing compilation errors:"
                echo ""
                # Show the error context from the log
                grep -A 5 "error TS" "$BACKEND_LOG" 2>/dev/null | head -40 || true
                echo ""
                print_info "Full log: $BACKEND_LOG"
                return 1
            fi
        fi

        if [ $count -ge $max_wait ]; then
            print_error "Backend failed to start within ${max_wait}s"
            print_error "Last 20 lines of backend log:"
            tail -20 "$BACKEND_LOG" 2>/dev/null || true
            return 1
        fi
    done

    print_success "Backend started (PID: $(cat $BACKEND_PID))"
}

start_frontend() {
    if is_process_running "$FRONTEND_PID"; then
        print_warning "Frontend is already running"
        return
    fi

    print_info "Starting frontend (localhost:11103)..."
    cd "$PROJECT_ROOT/apps/frontend"

    # Export environment variables for frontend
    export PORT="${PORT:-11103}"
    export NUXT_PORT="${NUXT_PORT:-11103}"
    # Frontend needs to know where backend is (different port in local-dev)
    export NUXT_PUBLIC_API_BASE="${NUXT_PUBLIC_API_BASE:-http://localhost:11104}"
    export NUXT_PUBLIC_INSTANCE_ID="${NUXT_PUBLIC_INSTANCE_ID:-localdev}"

    nohup pnpm dev > "$FRONTEND_LOG" 2>&1 &
    echo $! > "$FRONTEND_PID"
    cd "$PROJECT_ROOT"

    # Wait for frontend to start, checking for errors in logs
    print_info "Waiting for frontend to start..."
    local max_wait=30
    local count=0
    while ! is_port_in_use 11103; do
        sleep 1
        count=$((count + 1))

        # Check if process is still running
        if ! is_process_running "$FRONTEND_PID"; then
            print_error "Frontend process exited unexpectedly"
            print_error "Last 20 lines of frontend log:"
            tail -20 "$FRONTEND_LOG" 2>/dev/null || true
            return 1
        fi

        # Check for Nuxt/Vite build errors
        if [ -f "$FRONTEND_LOG" ]; then
            if grep -qE "(ERROR|error:|Build failed)" "$FRONTEND_LOG" 2>/dev/null; then
                print_error "Frontend build/startup error detected"
                print_error "Last 30 lines of frontend log:"
                tail -30 "$FRONTEND_LOG" 2>/dev/null || true
                return 1
            fi
        fi

        if [ $count -ge $max_wait ]; then
            print_error "Frontend failed to start within ${max_wait}s"
            print_error "Last 20 lines of frontend log:"
            tail -20 "$FRONTEND_LOG" 2>/dev/null || true
            return 1
        fi
    done

    print_success "Frontend started (PID: $(cat $FRONTEND_PID))"
}

stop_backend() {
    if is_process_running "$BACKEND_PID"; then
        local pid=$(cat "$BACKEND_PID")
        print_info "Stopping backend process tree (PID: $pid)..."

        # Kill the entire process tree (children first)
        kill_process_tree "$pid" TERM

        # Wait for process to terminate
        local count=0
        while ps -p "$pid" > /dev/null 2>&1; do
            sleep 0.5
            count=$((count + 1))
            if [ $count -ge 10 ]; then
                print_warning "Backend did not stop gracefully, forcing..."
                kill_process_tree "$pid" 9
                break
            fi
        done

        rm -f "$BACKEND_PID"
        print_success "Backend stopped"
    else
        print_info "Backend is not running (no PID file)"
    fi

    # Clean up any orphaned processes on port 11104
    if is_port_in_use 11104; then
        print_warning "Cleaning up orphaned backend processes on port 11104..."
        local pids=$(get_pids_on_port 11104)
        for pid in $pids; do
            kill_process_tree "$pid" TERM
        done
        sleep 1

        # Force kill if still running
        if is_port_in_use 11104; then
            pids=$(get_pids_on_port 11104)
            for pid in $pids; do
                kill -9 "$pid" 2>/dev/null || true
            done
            sleep 1
        fi
    fi
}

stop_frontend() {
    if is_process_running "$FRONTEND_PID"; then
        local pid=$(cat "$FRONTEND_PID")
        print_info "Stopping frontend process tree (PID: $pid)..."

        # Kill the entire process tree (children first)
        kill_process_tree "$pid" TERM

        # Wait for process to terminate
        local count=0
        while ps -p "$pid" > /dev/null 2>&1; do
            sleep 0.5
            count=$((count + 1))
            if [ $count -ge 10 ]; then
                print_warning "Frontend did not stop gracefully, forcing..."
                kill_process_tree "$pid" 9
                break
            fi
        done

        rm -f "$FRONTEND_PID"
        print_success "Frontend stopped"
    else
        print_info "Frontend is not running (no PID file)"
    fi

    # Clean up any orphaned processes on port 11103
    if is_port_in_use 11103; then
        print_warning "Cleaning up orphaned frontend processes on port 11103..."
        local pids=$(get_pids_on_port 11103)
        for pid in $pids; do
            kill_process_tree "$pid" TERM
        done
        sleep 1

        # Force kill if still running
        if is_port_in_use 11103; then
            pids=$(get_pids_on_port 11103)
            for pid in $pids; do
                kill -9 "$pid" 2>/dev/null || true
            done
            sleep 1
        fi
    fi
}

################################################################################
# Main Commands
################################################################################

start_services() {
    setup_directories

    # Check for port conflicts (only for critical ports - frontend/backend)
    # Note: Docker services will fail to start if their ports are in use, so we don't check them here
    local conflicting_ports=()
    if is_port_in_use 11103; then conflicting_ports+=("11103 (Frontend)"); fi
    if is_port_in_use 11104; then conflicting_ports+=("11104 (Backend)"); fi

    if [ ${#conflicting_ports[@]} -gt 0 ]; then
        print_error "The following ports are already in use:"
        for port in "${conflicting_ports[@]}"; do
            echo "  - $port"
        done
        print_info "Please stop conflicting services or use './dev/local-dev.sh stop' first"
        exit 1
    fi

    # Start infrastructure
    start_infrastructure

    # Start backend and frontend
    start_backend
    start_frontend

    echo ""
    print_success "Development environment started!"
    print_info "Frontend: http://localhost:11103"
    print_info "Backend API: http://localhost:11104/api"
    print_info "PostgreSQL: localhost:5432 (illustboard_user/illustboard_pass)"
    print_info "Redis: localhost:6379"
    print_info "MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
    print_info "MailHog Web UI: http://localhost:8025"
    echo ""
    print_info "View logs with: ./dev/local-dev.sh logs [frontend|backend|postgres|redis|minio|mailhog]"
}

stop_services() {
    stop_frontend
    stop_backend
    stop_infrastructure
    print_success "Development environment stopped"
}

restart_services() {
    print_info "Restarting development environment..."
    stop_services
    sleep 2
    start_services
}

show_logs() {
    local service="${1:-}"

    case "$service" in
        frontend)
            if [ -f "$FRONTEND_LOG" ]; then
                tail -f "$FRONTEND_LOG"
            else
                print_error "Frontend log file not found"
            fi
            ;;
        backend)
            if [ -f "$BACKEND_LOG" ]; then
                tail -f "$BACKEND_LOG"
            else
                print_error "Backend log file not found"
            fi
            ;;
        postgres|redis|minio|mailhog)
            docker compose -p illo-localdev -f dev/docker compose.local-dev.yml logs -f "$service"
            ;;
        "")
            print_info "Showing all logs..."
            print_info "Press Ctrl+C to stop"
            sleep 1
            docker compose -p illo-localdev -f dev/docker compose.local-dev.yml logs -f &
            tail -f "$FRONTEND_LOG" "$BACKEND_LOG" 2>/dev/null
            ;;
        *)
            print_error "Unknown service: $service"
            print_info "Available services: frontend, backend, postgres, redis, minio, mailhog"
            exit 1
            ;;
    esac
}

show_status() {
    print_info "Development environment status:"
    echo ""

    # Infrastructure status
    echo "Infrastructure (Docker):"
    docker compose -p illo-localdev -f dev/docker compose.local-dev.yml ps

    echo ""

    # Frontend status
    local frontend_orphans=""
    if is_process_running "$FRONTEND_PID"; then
        local pid=$(cat "$FRONTEND_PID")
        echo -e "Frontend: ${GREEN}RUNNING${NC} (PID: $pid, http://localhost:11103)"
    else
        echo -e "Frontend: ${RED}STOPPED${NC}"
        # Check for orphaned processes
        if is_port_in_use 11103; then
            frontend_orphans=$(get_pids_on_port 11103)
        fi
    fi

    # Backend status
    local backend_orphans=""
    if is_process_running "$BACKEND_PID"; then
        local pid=$(cat "$BACKEND_PID")
        echo -e "Backend: ${GREEN}RUNNING${NC} (PID: $pid, http://localhost:11104)"
    else
        echo -e "Backend: ${RED}STOPPED${NC}"
        # Check for orphaned processes
        if is_port_in_use 11104; then
            backend_orphans=$(get_pids_on_port 11104)
        fi
    fi

    # Warn about orphaned processes
    if [ -n "$frontend_orphans" ] || [ -n "$backend_orphans" ]; then
        echo ""
        print_warning "Orphaned processes detected!"
        [ -n "$frontend_orphans" ] && print_warning "  Port 11103 (Frontend): PIDs $frontend_orphans"
        [ -n "$backend_orphans" ] && print_warning "  Port 11104 (Backend): PIDs $backend_orphans"
        print_info "Run './dev/local-dev.sh cleanup' to terminate orphaned processes"
    fi
}

reset_environment() {
    print_warning "This will stop all services and remove all Docker volumes (data will be lost)"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Resetting development environment..."
        stop_services
        docker compose -p illo-localdev -f dev/docker compose.local-dev.yml down -v
        rm -rf "$LOG_DIR"/*
        print_success "Environment reset complete"
        print_info "Starting fresh environment..."
        start_services
    else
        print_info "Reset cancelled"
    fi
}

show_help() {
    echo "illo Development Environment Manager"
    echo ""
    echo "Usage: ./dev/local-dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  start              Start infrastructure + frontend/backend"
    echo "  stop               Stop all services"
    echo "  restart            Restart all services"
    echo "  logs [service]     Show logs (optionally for specific service)"
    echo "  status             Check status of all services"
    echo "  cleanup            Force cleanup all dev processes (kills orphaned processes)"
    echo "  reset              Stop all, remove volumes, and restart"
    echo "  help               Show this help message"
    echo ""
    echo "Services: frontend, backend, postgres, redis, minio, mailhog"
    echo ""
    echo "Examples:"
    echo "  ./dev/local-dev.sh start"
    echo "  ./dev/local-dev.sh logs frontend"
    echo "  ./dev/local-dev.sh status"
    echo "  ./dev/local-dev.sh cleanup      # If you have orphaned node processes"
}

################################################################################
# Main Command Router
################################################################################

case "${1:-}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    logs)
        show_logs "${2:-}"
        ;;
    status)
        show_status
        ;;
    cleanup)
        cleanup_dev_processes
        ;;
    reset)
        reset_environment
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: ${1:-}"
        echo ""
        show_help
        exit 1
        ;;
esac
