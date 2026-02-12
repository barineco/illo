# keys.sh - Key management commands
# This file is sourced by install.sh - do not execute directly

################################################################################
# Regenerate Bluesky OAuth JWK
################################################################################

cmd_regenerate_jwk() {
    local skip_confirm=false

    # Parse arguments
    for arg in "$@"; do
        case "$arg" in
            --yes|-y)
                skip_confirm=true
                ;;
        esac
    done

    echo ""
    echo -e "${BOLD}Regenerating Bluesky OAuth JWK${NC}"
    echo ""

    # Check .env exists
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file not found: $ENV_FILE"
        echo -e "${DIM}Run './install.sh setup-env' first to create the configuration.${NC}"
        exit 1
    fi

    load_env

    # Check if Bluesky OAuth is enabled (skip if --yes)
    if [ "$skip_confirm" = false ] && [ "$BLUESKY_OAUTH_ENABLED" != "true" ]; then
        print_warning "Bluesky OAuth is not enabled in your configuration."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Cancelled."
            return
        fi
    fi

    # Warning about session invalidation (skip if --yes)
    if [ "$skip_confirm" = false ]; then
        echo -e "${WARN} ${YELLOW}Warning:${NC} This will invalidate all existing Bluesky OAuth sessions."
        echo -e "   Users who logged in via Bluesky will need to re-authenticate."
        echo ""
        read -p "Continue? (y/N): " -n 1 -r
        echo

        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Cancelled."
            return
        fi
    fi

    # Generate new JWK
    local jwk_script="$PROJECT_ROOT/scripts/js/generate-bluesky-jwks.js"
    if [ ! -f "$jwk_script" ]; then
        print_error "JWK generation script not found: $jwk_script"
        exit 1
    fi

    start_spinner "Generating new BLUESKY_OAUTH_PRIVATE_JWK (ECDSA P-256)..."
    local new_jwk
    new_jwk=$(node "$jwk_script" 2>/dev/null)
    local gen_result=$?
    stop_spinner

    if [ $gen_result -ne 0 ] || [ -z "$new_jwk" ]; then
        step_fail "Failed to generate JWK"
        exit 1
    fi
    step_done "JWK generated"

    # Update .env file
    start_spinner "Updating $ENV_FILE..."
    set_env_var "BLUESKY_OAUTH_PRIVATE_JWK" "$new_jwk" "$ENV_FILE"
    stop_spinner
    step_done "JWK updated in .env"

    echo ""
    print_success "Bluesky OAuth JWK has been regenerated."
    echo ""
    echo -e "${WARN} ${YELLOW}Important:${NC} Please restart the backend service to apply changes:"
    echo -e "    ${CYAN}./install.sh restart backend${NC}"
    echo ""
}

################################################################################
# Export Secret Keys
################################################################################

cmd_export_keys() {
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Production environment file not found" >&2
        exit 1
    fi

    load_env

    echo "# illo Secret Keys Export"
    echo "# Generated: $(date)"
    echo "# KEEP THIS FILE SECURE!"
    echo ""
    echo "JWT_SECRET=$JWT_SECRET"
    echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
    echo "IMAGE_ENCRYPTION_KEY=$IMAGE_ENCRYPTION_KEY"
    echo "MESSAGE_ENCRYPTION_KEY=$MESSAGE_ENCRYPTION_KEY"
    echo "IMAGE_SIGNING_KEY=$IMAGE_SIGNING_KEY"
}
