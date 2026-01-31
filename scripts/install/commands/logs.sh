# logs.sh - Logs command
# This file is sourced by install.sh - do not execute directly

cmd_logs() {
    local service="${1:-}"

    check_env_file
    local profiles=$(get_compose_profiles)

    if [ -n "$service" ]; then
        print_prod "Showing logs for $service (Ctrl+C to exit)..."
        docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $profiles logs -f "$service"
    else
        print_prod "Showing all logs (Ctrl+C to exit)..."
        docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $profiles logs -f
    fi
}
