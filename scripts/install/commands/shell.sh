# shell.sh - Shell access command
# This file is sourced by install.sh - do not execute directly

cmd_shell() {
    local service="$1"

    if [ -z "$service" ]; then
        print_error "Please specify a service"
        echo ""
        echo "Usage: ./install.sh shell <service>"
        echo ""
        echo "Available: postgres, redis, minio, backend, frontend, nginx, cloudflared"
        exit 1
    fi

    local container=$(get_container_name "$service")
    if [ -z "$container" ]; then
        container="$service"
    fi

    if ! docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        print_error "Container $container is not running"
        exit 1
    fi

    print_prod "Opening shell in $service..."

    case "$service" in
        postgres|db|database)
            load_env
            docker exec -it "$container" psql -U "${POSTGRES_USER:-illustboard_user}" -d "${POSTGRES_DB:-illustboard_db}"
            ;;
        redis|cache)
            docker exec -it "$container" redis-cli
            ;;
        *)
            docker exec -it "$container" /bin/sh
            ;;
    esac
}
