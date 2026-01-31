# status.sh - Status commands
# This file is sourced by install.sh - do not execute directly

cmd_status() {
    echo ""
    echo -e "${BOLD}Production Services Status${NC}"
    echo ""

    check_env_file
    local profiles=$(get_compose_profiles)

    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $profiles ps

    echo ""
    cmd_status_brief
}

cmd_status_brief() {
    load_env

    echo -e "${CYAN}Service Health${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 40))${NC}"

    # Build service list based on configuration
    local services=("postgres" "redis" "minio" "backend" "frontend")

    # nginx is always running but with different names based on mode
    # Since both use the same container name, just check "nginx"
    services+=("nginx")

    # Add cloudflared if enabled
    if [ "$CLOUDFLARE_TUNNEL_ENABLED" = "true" ]; then
        services+=("cloudflared")
    fi

    # Add minio-console if enabled
    if [ "$EXPOSE_MINIO_CONSOLE" = "true" ]; then
        services+=("minio-console")
    fi

    for service in "${services[@]}"; do
        local container=$(get_container_name "$service")
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            # Get health status and strip any whitespace/newlines
            local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null | tr -d '[:space:]')
            # If no health check configured, mark as running
            if [ -z "$health" ] || [ "$health" = "<no value>" ]; then
                health="running"
            fi

            if [ "$health" = "healthy" ]; then
                echo -e "  ${CHECK} $service ${DIM}(healthy)${NC}"
            elif [ "$health" = "running" ]; then
                echo -e "  ${CHECK} $service ${DIM}(running)${NC}"
            else
                echo -e "  ${WARN} $service ${DIM}($health)${NC}"
            fi
        else
            echo -e "  ${CROSS} $service ${DIM}(not running)${NC}"
        fi
    done
    echo ""

    local nginx_port="${NGINX_PORT:-3000}"

    echo -e "${CYAN}Access URLs${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 40))${NC}"
    if [ "$CLOUDFLARE_TUNNEL_ENABLED" = "true" ]; then
        echo "  Application:  $BASE_URL (via Cloudflare Tunnel)"
        echo -e "  ${DIM}(No local ports exposed)${NC}"
    else
        echo "  Application:  http://localhost:$nginx_port"
        if [ -n "$BASE_URL" ] && [[ "$BASE_URL" != *"localhost"* ]]; then
            echo "  Production:   $BASE_URL"
        fi
    fi
    if [ "$EXPOSE_MINIO_CONSOLE" = "true" ]; then
        echo "  MinIO Console: http://localhost:${MINIO_CONSOLE_PORT:-9001}"
    fi
    echo ""
}
