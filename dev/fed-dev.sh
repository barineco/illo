#!/usr/bin/env bash

################################################################################
# fed-dev - Federation Testing Environment Manager
#
# This script manages a dual-instance setup for testing ActivityPub federation:
#   1. Federation Test Instance 1 (Full Docker, port 13000)
#   2. Federation Test Instance 2 (Full Docker, port 23000)
#
# This allows local testing of federation features between two illo
# instances without requiring external servers or tunneling services.
#
# Architecture:
#   Federation Test Instance 1:
#     - Infrastructure: Docker (ports 15432, 16379, 19000, 19001, 11025, 18025) [+10000 offset]
#     - Backend: Docker (internal)
#     - Frontend: Docker (internal)
#     - Access: http://localhost:13000 (Nginx)
#     - OrbStack domain: http://nginx-feddev.illo-feddev-1.orb.local
#
#   Federation Test Instance 2:
#     - Infrastructure: Docker (ports 25432, 26379, 29000, 29001, 21025, 28025) [+20000 offset]
#     - Backend: Docker (internal)
#     - Frontend: Docker (internal)
#     - Access: http://localhost:23000 (Nginx)
#     - OrbStack domain: http://nginx-feddev.illo-feddev-2.orb.local
#
# Usage:
#   ./dev/fed-dev.sh start              Start both federation test instances
#   ./dev/fed-dev.sh stop               Stop both instances
#   ./dev/fed-dev.sh restart            Restart both instances
#   ./dev/fed-dev.sh rebuild [service] [--no-cache]  Rebuild Docker images
#   ./dev/fed-dev.sh reset              Reset federation test databases
#   ./dev/fed-dev.sh logs [1|2]         Show logs from federation test instances
#   ./dev/fed-dev.sh status             Check status of both instances
#
################################################################################

set -e

# Cleanup function for graceful exit
cleanup() {
    # Stop spinner if running
    if [ -n "$SPINNER_PID" ]; then
        kill "$SPINNER_PID" 2>/dev/null || true
    fi
    # Restore cursor
    tput cnorm 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project root directory (parent of utils/)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Federation dev environment files
FEDDEV1_ENV_FILE="$PROJECT_ROOT/dev/.env.fed-dev-1"
FEDDEV2_ENV_FILE="$PROJECT_ROOT/dev/.env.fed-dev-2"

# Helper function to get env-file option if file exists
get_env_file_option() {
    local env_file="$1"
    if [ -f "$env_file" ]; then
        echo "--env-file $env_file"
    else
        echo ""
    fi
}

FEDDEV1_ENV_OPTION=$(get_env_file_option "$FEDDEV1_ENV_FILE")
FEDDEV2_ENV_OPTION=$(get_env_file_option "$FEDDEV2_ENV_FILE")

################################################################################
# Helper Functions
################################################################################

# Print colored message
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

print_feddev1() {
    echo -e "${MAGENTA}[FEDDEV-1]${NC} $1"
}

print_feddev2() {
    echo -e "${CYAN}[FEDDEV-2]${NC} $1"
}

# Check if a port is in use
is_port_in_use() {
    local port="$1"
    lsof -i ":$port" -sTCP:LISTEN -t > /dev/null 2>&1
}

# Wait for a port to be available
wait_for_port() {
    local port="$1"
    local service_name="$2"
    local max_attempts=30
    local attempt=1

    print_info "Waiting for $service_name (port $port) to be ready..."
    while ! is_port_in_use "$port"; do
        if [ $attempt -ge $max_attempts ]; then
            print_error "$service_name did not start within expected time"
            return 1
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    print_success "$service_name is ready on port $port"
}

# Spinner animation for progress indication
SPINNER_PID=""
start_spinner() {
    local message="$1"
    local spinner_chars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0

    # Hide cursor
    tput civis 2>/dev/null || true

    while true; do
        local char="${spinner_chars:$i:1}"
        printf "\r${BLUE}[%s]${NC} %s" "$char" "$message"
        i=$(( (i + 1) % ${#spinner_chars} ))
        sleep 0.1
    done &
    SPINNER_PID=$!
}

stop_spinner() {
    local final_message="$1"
    if [ -n "$SPINNER_PID" ]; then
        kill "$SPINNER_PID" 2>/dev/null || true
        wait "$SPINNER_PID" 2>/dev/null || true
        SPINNER_PID=""
    fi
    # Show cursor and clear line
    tput cnorm 2>/dev/null || true
    printf "\r\033[K"
    if [ -n "$final_message" ]; then
        echo -e "$final_message"
    fi
}

# Check if federation test environment files exist (optional - defaults are provided)
check_feddev_env() {
    local using_defaults=false

    if [ ! -f "$FEDDEV1_ENV_FILE" ]; then
        using_defaults=true
    fi

    if [ ! -f "$FEDDEV2_ENV_FILE" ]; then
        using_defaults=true
    fi

    if [ "$using_defaults" = true ]; then
        print_warning "Using development defaults (OrbStack domains with dev secrets)"
        print_info "For custom configuration, create:"
        print_info "  dev/.env.fed-dev-1 and dev/.env.fed-dev-2"
        echo ""
    fi
}

################################################################################
# Federation Test Instance 1 Management
################################################################################

# Kill processes using specific ports
kill_port_processes() {
    local ports=("$@")
    local killed=false

    for port in "${ports[@]}"; do
        if is_port_in_use "$port"; then
            print_warning "Killing process on port $port..."
            lsof -ti ":$port" | xargs kill -9 2>/dev/null || true
            killed=true
            sleep 1
        fi
    done

    if [ "$killed" = true ]; then
        print_info "Cleaned up existing processes"
        sleep 2  # Give processes time to fully terminate
    fi
}

# Start federation test instance 1
start_feddev1_instance() {
    check_feddev_env

    print_feddev1 "Starting federation test instance 1..."

    # Check for port conflicts and clean up automatically
    local conflicting_ports=()
    if is_port_in_use 13000; then conflicting_ports+=("13000"); fi
    if is_port_in_use 15432; then conflicting_ports+=("15432"); fi
    if is_port_in_use 16379; then conflicting_ports+=("16379"); fi
    if is_port_in_use 19000; then conflicting_ports+=("19000"); fi
    if is_port_in_use 19001; then conflicting_ports+=("19001"); fi
    if is_port_in_use 11025; then conflicting_ports+=("11025"); fi
    if is_port_in_use 18025; then conflicting_ports+=("18025"); fi

    if [ ${#conflicting_ports[@]} -gt 0 ]; then
        print_warning "Instance 1 ports in use: ${conflicting_ports[*]}"
        print_info "Cleaning up existing processes..."

        # Stop any running federation test containers first
        docker-compose -p illo-feddev-1 -f dev/docker-compose.fed-dev-1.yml down 2>/dev/null || true

        # Kill any remaining processes on those ports
        kill_port_processes "${conflicting_ports[@]}"
    fi

    # Start federation test instance 1 (quiet progress to avoid output spam)
    docker-compose -p illo-feddev-1 -f dev/docker-compose.fed-dev-1.yml $FEDDEV1_ENV_OPTION up -d --quiet-pull 2>&1

    # Wait for services to be ready
    sleep 3

    # Wait for Nginx to be accessible (with simpler output)
    local max_attempts=30
    local attempt=1
    while ! is_port_in_use 13000; do
        if [ $attempt -ge $max_attempts ]; then
            print_error "Instance 1 did not start within expected time"
            return 1
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    print_feddev1 "Instance 1 ready (http://localhost:13000)"
}

# Stop federation test instance 1
stop_feddev1_instance() {
    print_feddev1 "Stopping federation test instance 1..."
    docker-compose -p illo-feddev-1 -f dev/docker-compose.fed-dev-1.yml down
    print_success "Federation test instance 1 stopped"
}

# Check federation test instance 1 status
check_feddev1_instance_status() {
    echo -e "${MAGENTA}=== Federation Test Instance 1 Status ===${NC}"
    docker-compose -p illo-feddev-1 -f dev/docker-compose.fed-dev-1.yml ps
}

################################################################################
# Federation Test Instance 2 Management
################################################################################

# Start federation test instance 2
start_feddev2_instance() {
    check_feddev_env

    print_feddev2 "Starting federation test instance 2..."

    # Check for port conflicts and clean up automatically
    local conflicting_ports=()
    if is_port_in_use 23000; then conflicting_ports+=("23000"); fi
    if is_port_in_use 25432; then conflicting_ports+=("25432"); fi
    if is_port_in_use 26379; then conflicting_ports+=("26379"); fi
    if is_port_in_use 29000; then conflicting_ports+=("29000"); fi
    if is_port_in_use 29001; then conflicting_ports+=("29001"); fi
    if is_port_in_use 21025; then conflicting_ports+=("21025"); fi
    if is_port_in_use 28025; then conflicting_ports+=("28025"); fi

    if [ ${#conflicting_ports[@]} -gt 0 ]; then
        print_warning "Instance 2 ports in use: ${conflicting_ports[*]}"
        print_info "Cleaning up existing processes..."

        # Stop any running federation test containers first
        docker-compose -p illo-feddev-2 -f dev/docker-compose.fed-dev-2.yml down 2>/dev/null || true

        # Kill any remaining processes on those ports
        kill_port_processes "${conflicting_ports[@]}"
    fi

    # Start federation test instance 2 (quiet progress to avoid output spam)
    docker-compose -p illo-feddev-2 -f dev/docker-compose.fed-dev-2.yml $FEDDEV2_ENV_OPTION up -d --quiet-pull 2>&1

    # Wait for services to be ready
    sleep 3

    # Wait for Nginx to be accessible (with simpler output)
    local max_attempts=30
    local attempt=1
    while ! is_port_in_use 23000; do
        if [ $attempt -ge $max_attempts ]; then
            print_error "Instance 2 did not start within expected time"
            return 1
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    print_feddev2 "Instance 2 ready (http://localhost:23000)"
}

# Stop federation test instance 2
stop_feddev2_instance() {
    print_feddev2 "Stopping federation test instance 2..."
    docker-compose -p illo-feddev-2 -f dev/docker-compose.fed-dev-2.yml down
    print_success "Federation test instance 2 stopped"
}

# Check federation test instance 2 status
check_feddev2_instance_status() {
    echo -e "${CYAN}=== Federation Test Instance 2 Status ===${NC}"
    docker-compose -p illo-feddev-2 -f dev/docker-compose.fed-dev-2.yml ps
}

################################################################################
# Reset Functions
################################################################################

# Reset federation test databases
reset_feddev_databases() {
    print_warning "This will delete all data in BOTH federation test databases!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Database reset cancelled"
        return
    fi

    print_info "Resetting federation test databases..."

    # Stop both instances
    stop_feddev1_instance
    stop_feddev2_instance

    # Remove volumes
    print_info "Removing Docker volumes..."
    docker-compose -p illo-feddev-1 -f dev/docker-compose.fed-dev-1.yml down -v
    docker-compose -p illo-feddev-2 -f dev/docker-compose.fed-dev-2.yml down -v

    print_success "Federation test databases reset complete"
    print_info "Run 'fed-dev start' to restart with fresh databases"
}

################################################################################
# Rebuild Functions
################################################################################

# Clean up logs directory
clean_logs_directory() {
    local logs_dir="$PROJECT_ROOT/logs"
    if [ -d "$logs_dir" ]; then
        print_info "Cleaning up logs directory..."
        # Remove log files but keep .gitignore
        find "$logs_dir" -type f -name "*.log" -delete 2>/dev/null || true
        print_success "Logs directory cleaned"
    fi
}

# Clean local dist and rebuild TypeScript
# This ensures Docker builds use fresh compiled output
clean_and_build_local() {
    local service="$1"

    if [ "$service" = "backend" ] || [ "$service" = "all" ]; then
        local backend_dist="$PROJECT_ROOT/apps/backend/dist"
        if [ -d "$backend_dist" ]; then
            print_info "Cleaning backend dist directory..."
            rm -rf "$backend_dist"
        fi
        print_info "Rebuilding backend TypeScript..."
        (cd "$PROJECT_ROOT/apps/backend" && pnpm build)
        print_success "Backend rebuilt"
    fi

    if [ "$service" = "frontend" ] || [ "$service" = "all" ]; then
        local frontend_dist="$PROJECT_ROOT/apps/frontend/.output"
        local frontend_nuxt="$PROJECT_ROOT/apps/frontend/.nuxt"
        if [ -d "$frontend_dist" ] || [ -d "$frontend_nuxt" ]; then
            print_info "Cleaning frontend build directories..."
            rm -rf "$frontend_dist" "$frontend_nuxt" 2>/dev/null || true
        fi
        # Note: Frontend is built inside Docker, so we just clean here
        print_success "Frontend build directories cleaned"
    fi
}

# Rebuild federation test Docker images
# Arguments: Any combination of: [1|2] [frontend|backend|all] [--no-cache]
rebuild_feddev_images() {
    local instance="both"
    local service="all"
    local no_cache_flag=""

    # Parse arguments
    for arg in "$@"; do
        case "$arg" in
            1|2)
                instance="$arg"
                ;;
            frontend|backend|all)
                service="$arg"
                ;;
            --no-cache)
                no_cache_flag="--no-cache"
                print_warning "Building with --no-cache (this may take longer)"
                ;;
        esac
    done

    # Clean logs directory before rebuild
    clean_logs_directory

    # Clean local dist and rebuild TypeScript before Docker build
    # This ensures the Docker build copies fresh compiled output
    clean_and_build_local "$service"

    # Helper function to build for a specific instance
    build_instance() {
        local inst="$1"
        local svc="$2"
        local cache_flag="$3"

        if [ "$inst" = "1" ]; then
            if [ "$svc" = "all" ]; then
                print_feddev1 "Rebuilding all services for instance 1..."
                docker-compose  -p illo-feddev-1 -f dev/docker-compose.fed-dev-1.yml build $cache_flag
            else
                print_feddev1 "Rebuilding $svc for instance 1..."
                docker-compose  -p illo-feddev-1 -f dev/docker-compose.fed-dev-1.yml build $cache_flag ${svc}-feddev
            fi
        else
            if [ "$svc" = "all" ]; then
                print_feddev2 "Rebuilding all services for instance 2..."
                docker-compose  -p illo-feddev-2 -f dev/docker-compose.fed-dev-2.yml build $cache_flag
            else
                print_feddev2 "Rebuilding $svc for instance 2..."
                docker-compose  -p illo-feddev-2 -f dev/docker-compose.fed-dev-2.yml build $cache_flag ${svc}-feddev
            fi
        fi
    }

    case "$instance" in
        1)
            print_info "Rebuilding $service for federation test instance 1..."
            echo ""
            build_instance "1" "$service" "$no_cache_flag"
            print_success "$service rebuilt for instance 1"
            ;;
        2)
            print_info "Rebuilding $service for federation test instance 2..."
            echo ""
            build_instance "2" "$service" "$no_cache_flag"
            print_success "$service rebuilt for instance 2"
            ;;
        both)
            print_info "Rebuilding $service for both federation test instances..."
            echo ""
            build_instance "1" "$service" "$no_cache_flag"
            build_instance "2" "$service" "$no_cache_flag"
            print_success "$service rebuilt for both instances"
            ;;
    esac

    echo ""
    print_info "Rebuild complete. Run 'fed-dev restart' to apply changes."
}

################################################################################
# Command Handlers
################################################################################

cmd_start() {
    print_info "Starting federation testing environment..."
    echo ""

    # Start spinner for visual feedback
    start_spinner "Starting both federation test instances..."

    # Capture output from both instances
    local output1_file=$(mktemp)
    local output2_file=$(mktemp)

    # Start both instances in parallel, capturing their output
    start_feddev1_instance > "$output1_file" 2>&1 &
    local pid1=$!

    start_feddev2_instance > "$output2_file" 2>&1 &
    local pid2=$!

    # Wait for both to complete
    local exit1=0 exit2=0
    wait $pid1 || exit1=$?
    wait $pid2 || exit2=$?

    # Stop spinner
    stop_spinner ""

    # Show results
    if [ $exit1 -eq 0 ]; then
        print_feddev1 "Instance 1 ready (http://localhost:13000)"
    else
        print_error "Instance 1 failed to start"
        cat "$output1_file"
    fi

    if [ $exit2 -eq 0 ]; then
        print_feddev2 "Instance 2 ready (http://localhost:23000)"
    else
        print_error "Instance 2 failed to start"
        cat "$output2_file"
    fi

    # Cleanup temp files
    rm -f "$output1_file" "$output2_file"

    echo ""

    if [ $exit1 -eq 0 ] && [ $exit2 -eq 0 ]; then
        print_success "Federation testing environment started!"
        echo ""
        echo -e "${MAGENTA}Federation Test Instance 1:${NC}"
        echo "  Application: http://localhost:13000"
        echo "  MinIO Console: http://localhost:19001 (minioadmin_fed/minioadmin_fed)"
        echo "  MailHog Web UI: http://localhost:18025"
        echo ""
        echo -e "${CYAN}Federation Test Instance 2:${NC}"
        echo "  Application: http://localhost:23000"
        echo "  MinIO Console: http://localhost:29001 (minioadmin_fed/minioadmin_fed)"
        echo "  MailHog Web UI: http://localhost:28025"
        echo ""
        print_info "You can now test federation between these two instances!"
    else
        print_error "Some instances failed to start. Check the logs above."
        exit 1
    fi
}

cmd_stop() {
    print_info "Stopping federation testing environment..."
    echo ""

    # Stop both instances
    stop_feddev1_instance
    echo ""
    stop_feddev2_instance
    echo ""

    print_success "Federation testing environment stopped"
}

cmd_restart() {
    local instance="both"
    local service="all"
    local force_recreate=""

    # Parse arguments
    for arg in "$@"; do
        case "$arg" in
            1|2)
                instance="$arg"
                ;;
            frontend|backend|all)
                service="$arg"
                ;;
            --force-recreate)
                force_recreate="--force-recreate"
                print_info "Using --force-recreate to recreate containers with new images"
                ;;
        esac
    done

    # Helper function to restart for a specific instance
    restart_instance() {
        local inst="$1"
        local svc="$2"
        local recreate_flag="$3"
        local output_file=$(mktemp)
        local exit_code=0

        if [ "$inst" = "1" ]; then
            if [ "$svc" = "all" ]; then
                print_feddev1 "Restarting all services for instance 1..."
                if [ -n "$recreate_flag" ]; then
                    # Use --quiet-pull to reduce output noise, redirect verbose output
                    docker-compose -p illo-feddev-1 -f dev/docker-compose.fed-dev-1.yml $FEDDEV1_ENV_OPTION up -d --quiet-pull $recreate_flag > "$output_file" 2>&1 || exit_code=$?
                else
                    docker-compose -p illo-feddev-1 -f dev/docker-compose.fed-dev-1.yml restart > "$output_file" 2>&1 || exit_code=$?
                fi
            else
                print_feddev1 "Restarting $svc for instance 1..."
                if [ -n "$recreate_flag" ]; then
                    docker-compose -p illo-feddev-1 -f dev/docker-compose.fed-dev-1.yml $FEDDEV1_ENV_OPTION up -d --quiet-pull $recreate_flag ${svc}-feddev > "$output_file" 2>&1 || exit_code=$?
                else
                    docker-compose -p illo-feddev-1 -f dev/docker-compose.fed-dev-1.yml restart ${svc}-feddev > "$output_file" 2>&1 || exit_code=$?
                fi
            fi
            # Show summary instead of verbose output
            if [ $exit_code -eq 0 ]; then
                local running=$(docker-compose -p illo-feddev-1 -f dev/docker-compose.fed-dev-1.yml ps --format "{{.Name}}" 2>/dev/null | wc -l | tr -d ' ')
                print_feddev1 "✓ $running containers running"
            else
                print_error "Instance 1 restart failed:"
                cat "$output_file"
            fi
        else
            if [ "$svc" = "all" ]; then
                print_feddev2 "Restarting all services for instance 2..."
                if [ -n "$recreate_flag" ]; then
                    docker-compose -p illo-feddev-2 -f dev/docker-compose.fed-dev-2.yml $FEDDEV2_ENV_OPTION up -d --quiet-pull $recreate_flag > "$output_file" 2>&1 || exit_code=$?
                else
                    docker-compose -p illo-feddev-2 -f dev/docker-compose.fed-dev-2.yml restart > "$output_file" 2>&1 || exit_code=$?
                fi
            else
                print_feddev2 "Restarting $svc for instance 2..."
                if [ -n "$recreate_flag" ]; then
                    docker-compose -p illo-feddev-2 -f dev/docker-compose.fed-dev-2.yml $FEDDEV2_ENV_OPTION up -d --quiet-pull $recreate_flag ${svc}-feddev > "$output_file" 2>&1 || exit_code=$?
                else
                    docker-compose -p illo-feddev-2 -f dev/docker-compose.fed-dev-2.yml restart ${svc}-feddev > "$output_file" 2>&1 || exit_code=$?
                fi
            fi
            # Show summary instead of verbose output
            if [ $exit_code -eq 0 ]; then
                local running=$(docker-compose -p illo-feddev-2 -f dev/docker-compose.fed-dev-2.yml ps --format "{{.Name}}" 2>/dev/null | wc -l | tr -d ' ')
                print_feddev2 "✓ $running containers running"
            else
                print_error "Instance 2 restart failed:"
                cat "$output_file"
            fi
        fi

        rm -f "$output_file"
        return $exit_code
    }

    case "$instance" in
        1)
            print_info "Restarting $service for federation test instance 1..."
            echo ""
            restart_instance "1" "$service" "$force_recreate"
            print_success "$service restarted for instance 1"
            ;;
        2)
            print_info "Restarting $service for federation test instance 2..."
            echo ""
            restart_instance "2" "$service" "$force_recreate"
            print_success "$service restarted for instance 2"
            ;;
        both)
            print_info "Restarting $service for both federation test instances..."
            echo ""
            restart_instance "1" "$service" "$force_recreate"
            restart_instance "2" "$service" "$force_recreate"
            print_success "$service restarted for both instances"
            ;;
    esac
}

cmd_reset() {
    print_warning "This will reset BOTH federation test instance databases!"
    echo ""
    reset_feddev_databases
}

cmd_logs() {
    local instance="${1:-}"
    local service="${2:-backend}"  # Default to backend logs

    case "$instance" in
        1)
            local container="illo-feddev1-${service}-feddev"
            print_feddev1 "Showing ${service} logs for instance 1 (Ctrl+C to exit)..."
            echo ""
            docker logs "$container" --tail=100 -f 2>&1
            ;;
        2)
            local container="illo-feddev2-${service}-feddev"
            print_feddev2 "Showing ${service} logs for instance 2 (Ctrl+C to exit)..."
            echo ""
            docker logs "$container" --tail=100 -f 2>&1
            ;;
        "")
            print_info "Showing backend logs from both instances (Ctrl+C to exit)..."
            echo ""
            (docker logs illo-feddev1-backend-fedtest --tail=50 -f 2>&1 | sed 's/^/[Fed1] /') &
            (docker logs illo-feddev2-backend-fedtest --tail=50 -f 2>&1 | sed 's/^/[Fed2] /') &
            wait
            ;;
        *)
            print_error "Unknown instance: $instance"
            print_info "Usage: fed-dev logs [1|2] [service]"
            print_info "Services: backend (default), frontend, nginx, postgres, redis, minio"
            exit 1
            ;;
    esac
}

cmd_status() {
    echo ""
    check_feddev1_instance_status
    echo ""
    check_feddev2_instance_status
    echo ""

    # Summary
    echo -e "${GREEN}=== Summary ===${NC}"
    if is_port_in_use 13000; then
        echo -e "Federation Test Instance 1: ${GREEN}RUNNING${NC} (http://localhost:13000)"
    else
        echo -e "Federation Test Instance 1: ${RED}NOT RUNNING${NC}"
    fi

    if is_port_in_use 23000; then
        echo -e "Federation Test Instance 2: ${GREEN}RUNNING${NC} (http://localhost:23000)"
    else
        echo -e "Federation Test Instance 2: ${RED}NOT RUNNING${NC}"
    fi
}

cmd_rebuild() {
    # Pass all arguments to rebuild_feddev_images
    rebuild_feddev_images "$@"
}

cmd_help() {
    echo "Usage: ./dev/fed-dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  start                  Start both federation test instances"
    echo "  stop                   Stop both instances"
    echo "  restart [1|2] [svc] [--force-recreate]  Restart instances"
    echo "  rebuild [1|2] [svc] [--no-cache]  Rebuild Docker images"
    echo "  reset                  Reset federation test databases (deletes all data)"
    echo "  logs [1|2] [svc]       Show logs (optionally specify instance and service)"
    echo "  status                 Check status of both instances"
    echo "  help                   Show this help message"
    echo ""
    echo "Services: frontend, backend, all (default)"
    echo ""
    echo "Federation Testing Workflow:"
    echo "  1. Run './dev/fed-dev.sh start' to start both instances (OrbStack recommended)"
    echo "  2. Access instance 1 at https://nginx-feddev.illo-feddev-1.orb.local"
    echo "  3. Access instance 2 at https://nginx-feddev.illo-feddev-2.orb.local"
    echo "  4. Test federation features between the two instances"
    echo "  5. Run './dev/fed-dev.sh stop' when done"
    echo ""
    echo "Prerequisites:"
    echo "  - OrbStack (macOS) - for automatic domain resolution"
    echo "  - OR Cloudflare Tunnel - for external access"
    echo "  - Environment files (.env.fed-dev-1/2) are OPTIONAL - defaults provided"
    echo ""
    echo "Examples:"
    echo "  ./dev/fed-dev.sh start"
    echo "  ./dev/fed-dev.sh status"
    echo "  ./dev/fed-dev.sh rebuild                    # Rebuild all for both instances"
    echo "  ./dev/fed-dev.sh rebuild backend            # Rebuild backend for both"
    echo "  ./dev/fed-dev.sh rebuild 1 backend          # Rebuild backend for instance 1 only"
    echo "  ./dev/fed-dev.sh rebuild 2 frontend         # Rebuild frontend for instance 2 only"
    echo "  ./dev/fed-dev.sh rebuild backend --no-cache # Rebuild without cache"
    echo "  ./dev/fed-dev.sh restart                    # Restart all for both instances"
    echo "  ./dev/fed-dev.sh restart backend            # Restart backend for both"
    echo "  ./dev/fed-dev.sh restart 1 backend          # Restart backend for instance 1 only"
    echo "  ./dev/fed-dev.sh restart --force-recreate   # Recreate containers with new images"
    echo "  ./dev/fed-dev.sh logs 1                     # Show backend logs for instance 1"
    echo "  ./dev/fed-dev.sh logs 2 frontend            # Show frontend logs for instance 2"
    echo "  ./dev/fed-dev.sh reset"
}

################################################################################
# Main
################################################################################

# Parse command
COMMAND="${1:-help}"
shift 2>/dev/null || true  # Remove first argument, ignore error if no args

case "$COMMAND" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart "$@"
        ;;
    rebuild)
        cmd_rebuild "$@"
        ;;
    reset)
        cmd_reset
        ;;
    logs)
        cmd_logs "$@"
        ;;
    status)
        cmd_status
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        echo ""
        cmd_help
        exit 1
        ;;
esac
