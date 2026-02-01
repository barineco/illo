# maintenance.sh - Maintenance mode management
# This file is sourced by install.sh - do not execute directly

################################################################################
# Maintenance Mode Commands
################################################################################

cmd_maintenance_on() {
    local nginx_container=$(get_container_name "nginx")

    if ! docker ps --format '{{.Names}}' | grep -q "^${nginx_container}$"; then
        print_error "nginx container is not running"
        exit 1
    fi

    start_spinner "Enabling maintenance mode..."

    # Create maintenance flag file on host
    touch "${PROJECT_ROOT}/nginx/maintenance.flag"

    # Reload nginx to apply maintenance mode
    docker exec "$nginx_container" nginx -s reload 2>/dev/null

    stop_spinner true "Maintenance mode enabled"

    print_warning "Site is now in maintenance mode"
}

cmd_maintenance_off() {
    local nginx_container=$(get_container_name "nginx")

    if ! docker ps --format '{{.Names}}' | grep -q "^${nginx_container}$"; then
        print_error "nginx container is not running"
        exit 1
    fi

    start_spinner "Disabling maintenance mode..."

    # Remove maintenance flag file from host
    rm -f "${PROJECT_ROOT}/nginx/maintenance.flag"

    # Reload nginx to restore normal operation
    docker exec "$nginx_container" nginx -s reload 2>/dev/null

    stop_spinner true "Maintenance mode disabled"

    print_success "Site is back online"
}

cmd_maintenance_status() {
    if [ -f "${PROJECT_ROOT}/nginx/maintenance.flag" ]; then
        echo ""
        print_warning "Maintenance mode: ENABLED"
        echo ""
    else
        echo ""
        print_success "Maintenance mode: DISABLED"
        echo ""
    fi
}

################################################################################
# Wait for services to be healthy
################################################################################

wait_for_healthy() {
    local max_wait=120  # Maximum wait time in seconds
    local elapsed=0
    local check_interval=2

    echo ""
    print_info "Waiting for services to be healthy..."

    while [ $elapsed -lt $max_wait ]; do
        local all_healthy=true

        # Check backend
        local backend_container=$(get_container_name "backend")
        if docker ps --format '{{.Names}}' | grep -q "^${backend_container}$"; then
            if ! docker exec "$backend_container" wget -q --spider http://127.0.0.1:11104/api/health 2>/dev/null; then
                all_healthy=false
            fi
        else
            all_healthy=false
        fi

        # Check frontend
        local frontend_container=$(get_container_name "frontend")
        if docker ps --format '{{.Names}}' | grep -q "^${frontend_container}$"; then
            if ! docker exec "$frontend_container" wget -q --spider http://127.0.0.1:11103 2>/dev/null; then
                all_healthy=false
            fi
        else
            all_healthy=false
        fi

        if [ "$all_healthy" = true ]; then
            echo ""
            print_success "All services are healthy"
            return 0
        fi

        elapsed=$((elapsed + check_interval))
        sleep $check_interval
        printf "."
    done

    echo ""
    print_warning "Timeout waiting for services to be healthy"
    return 1
}
