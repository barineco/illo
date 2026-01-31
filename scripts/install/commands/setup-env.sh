# setup-env.sh - Environment setup command
# This file is sourced by install.sh - do not execute directly

cmd_setup_env() {
    echo ""
    echo -e "${BOLD}${MAGENTA}╭─────────────────────────────────────────────────────────────╮${NC}"
    echo -e "${BOLD}${MAGENTA}│${NC}       ${BOLD}${APP_NAME} Environment Setup${NC}                            ${BOLD}${MAGENTA}│${NC}"
    echo -e "${BOLD}${MAGENTA}╰─────────────────────────────────────────────────────────────╯${NC}"

    # Step 1: Check dependencies
    start_steps 6
    check_dependencies

    # Load existing env if present (for default values)
    local is_reconfigure=false
    if [ -f "$ENV_FILE" ]; then
        load_env
        is_reconfigure=true
        step_done "Existing configuration loaded (values will be used as defaults)"
    else
        if [ -f "$ENV_EXAMPLE_FILE" ]; then
            cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
            step_done "Created .env from example"
        else
            step_fail "Example environment file not found"
            exit 1
        fi
    fi

    # Step 2: Interactive configuration
    step "Configuring your instance..."
    echo ""
    if [ "$is_reconfigure" = true ]; then
        echo -e "${DIM}Press Enter to keep existing values shown in brackets.${NC}"
        echo ""
    fi

    # --- Domain Configuration ---
    echo -e "${CYAN}Domain Configuration${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 50))${NC}"
    echo -e "${DIM}Enter your instance's public URL (e.g., https://art.example.com)${NC}"
    prompt_input "Base URL" "${BASE_URL:-https://localhost:3000}" CFG_BASE_URL

    # Ensure BASE_URL has https:// protocol
    if [[ "$CFG_BASE_URL" != http://* ]] && [[ "$CFG_BASE_URL" != https://* ]]; then
        CFG_BASE_URL="https://${CFG_BASE_URL}"
        echo -e "  ${DIM}(Added https:// protocol: $CFG_BASE_URL)${NC}"
    fi

    # Derive other URLs from BASE_URL
    CFG_FRONTEND_URL="$CFG_BASE_URL"
    CFG_MINIO_PUBLIC_URL="$CFG_BASE_URL"
    echo -e "  ${DIM}FRONTEND_URL: $CFG_FRONTEND_URL${NC}"
    echo -e "  ${DIM}MINIO_PUBLIC_URL: $CFG_MINIO_PUBLIC_URL${NC}"
    echo ""

    # --- Instance Branding ---
    echo -e "${CYAN}Instance Branding${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 50))${NC}"
    echo -e "${DIM}Service name displayed in UI header, emails, and 2FA.${NC}"
    echo -e "${DIM}Example: illo.ink, MyIllo, My Art Community${NC}"

    # Default to hostname from BASE_URL if not set
    local default_instance_name="${INSTANCE_NAME:-${CFG_BASE_URL#https://}}"
    default_instance_name="${default_instance_name#http://}"
    prompt_input "Instance name" "$default_instance_name" CFG_INSTANCE_NAME

    echo -e "${DIM}Tagline displayed in browser title (optional).${NC}"
    echo -e "${DIM}Format: \"Instance Name - Tagline\" or \"Page Title | Instance Name\"${NC}"
    prompt_input "Instance tagline" "${INSTANCE_TAGLINE:-}" CFG_INSTANCE_TAGLINE
    echo ""

    # --- Instance ID ---
    echo -e "${CYAN}Instance Identification${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 50))${NC}"
    echo -e "${DIM}Unique ID for this instance (used for cookie namespacing)${NC}"
    prompt_input "Instance ID" "${INSTANCE_ID:-prod}" CFG_INSTANCE_ID
    echo ""

    # --- Database Configuration ---
    echo -e "${CYAN}Database Configuration${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 50))${NC}"
    prompt_input "PostgreSQL user" "${POSTGRES_USER:-illustboard_user}" CFG_POSTGRES_USER
    prompt_input "PostgreSQL database" "${POSTGRES_DB:-illustboard_db}" CFG_POSTGRES_DB
    prompt_secret "PostgreSQL password" \
        "$POSTGRES_PASSWORD" CFG_POSTGRES_PASSWORD \
        "generate_secret_key 16"

    # --- MinIO Configuration ---
    echo -e "${CYAN}Object Storage (MinIO) Configuration${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 50))${NC}"
    prompt_input "MinIO admin user" "${MINIO_ROOT_USER:-admin}" CFG_MINIO_USER
    prompt_secret "MinIO admin password" \
        "$MINIO_ROOT_PASSWORD" CFG_MINIO_PASSWORD \
        "generate_secret_key 16"
    prompt_input "Storage bucket name" "${S3_BUCKET:-illustboard}" CFG_S3_BUCKET
    echo ""

    # --- SMTP Configuration ---
    echo -e "${CYAN}Email Configuration (SMTP)${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 50))${NC}"
    local smtp_default="y"
    [ -z "$SMTP_HOST" ] && smtp_default="n"
    [ -n "$SMTP_HOST" ] && smtp_default="y"
    prompt_yesno "Configure email sending?" "$smtp_default" CFG_CONFIGURE_SMTP

    if [ "$CFG_CONFIGURE_SMTP" = "true" ]; then
        echo ""
        echo -e "  ${DIM}Popular SMTP providers:${NC}"
        echo -e "  ${DIM}  - SendGrid: smtp.sendgrid.net${NC}"
        echo -e "  ${DIM}  - Mailgun: smtp.mailgun.org${NC}"
        echo -e "  ${DIM}  - Postmark: smtp.postmarkapp.com${NC}"
        echo ""
        prompt_input "SMTP host" "${SMTP_HOST:-smtp.sendgrid.net}" CFG_SMTP_HOST
        prompt_input "SMTP port" "${SMTP_PORT:-587}" CFG_SMTP_PORT
        local smtp_secure_default="y"
        [ "$SMTP_SECURE" = "false" ] && smtp_secure_default="n"
        prompt_yesno "Use TLS/SSL?" "$smtp_secure_default" CFG_SMTP_SECURE
        prompt_input "SMTP username" "${SMTP_USER:-}" CFG_SMTP_USER
        prompt_token "SMTP password/API key" \
            "$SMTP_PASS" CFG_SMTP_PASS \
            "Enter your SMTP password or API key from your email provider"
        prompt_input "Sender email" "${MAIL_FROM:-noreply@${CFG_BASE_URL#https://}}" CFG_MAIL_FROM
    else
        CFG_SMTP_HOST=""
        CFG_SMTP_PORT="587"
        CFG_SMTP_SECURE="true"
        CFG_SMTP_USER=""
        CFG_SMTP_PASS=""
        CFG_MAIL_FROM=""
    fi
    echo ""

    # --- Nginx Port ---
    echo -e "${CYAN}Nginx Configuration${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 50))${NC}"
    echo -e "${DIM}Port to expose (use 80 for production with reverse proxy)${NC}"
    prompt_input "Nginx port" "${NGINX_PORT:-3000}" CFG_NGINX_PORT
    echo ""

    # --- Cloudflare Tunnel Configuration ---
    echo -e "${CYAN}Cloudflare Tunnel (Recommended)${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 50))${NC}"
    echo -e "${DIM}Cloudflare Tunnel provides free HTTPS, DDoS protection,${NC}"
    echo -e "${DIM}and AI/bot crawler blocking without exposing ports.${NC}"
    echo ""
    local cf_default="y"
    [ "$CLOUDFLARE_TUNNEL_ENABLED" = "false" ] && cf_default="n"
    prompt_yesno "Use Cloudflare Tunnel?" "$cf_default" CFG_USE_CF_TUNNEL

    if [ "$CFG_USE_CF_TUNNEL" = "true" ]; then
        # Warn if BASE_URL contains localhost
        if [[ "$CFG_BASE_URL" == *"localhost"* ]]; then
            echo ""
            echo -e "  ${YELLOW}Warning: BASE_URL contains 'localhost' but you're using Cloudflare Tunnel.${NC}"
            echo -e "  ${YELLOW}Cloudflare Tunnel requires a real domain name.${NC}"
            echo ""
            prompt_yesno "Continue anyway?" "n" CF_CONTINUE
            if [ "$CF_CONTINUE" != "true" ]; then
                echo -e "  ${DIM}Please go back and set a proper domain in BASE_URL.${NC}"
                CFG_USE_CF_TUNNEL="false"
            fi
        fi
    fi

    if [ "$CFG_USE_CF_TUNNEL" = "true" ]; then
        echo ""
        if [ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
            echo -e "  ${CYAN}Setup Steps:${NC}"
            echo -e "  ${DIM}1. Go to Cloudflare Zero Trust Dashboard${NC}"
            echo -e "  ${DIM}   https://one.dash.cloudflare.com/${NC}"
            echo -e "  ${DIM}2. Navigate to: Access > Tunnels > Create Tunnel${NC}"
            echo -e "  ${DIM}3. Select 'Cloudflared' connector, name your tunnel${NC}"
            echo -e "  ${DIM}4. Choose 'Docker' and copy ONLY the token value${NC}"
            echo -e "  ${DIM}   (the long string starting with 'eyJ...')${NC}"
            echo ""
        fi
        prompt_token "Cloudflare Tunnel Token" \
            "$CLOUDFLARE_TUNNEL_TOKEN" CFG_CF_TUNNEL_TOKEN

        if [ -n "$CFG_CF_TUNNEL_TOKEN" ]; then
            echo -e "  ${GREEN}Token configured!${NC}"
            echo ""
            echo -e "  ${CYAN}Public Hostname in Cloudflare:${NC}"
            echo -e "  ${BOLD}Hostname:${NC}     ${CFG_BASE_URL#https://}"
            echo -e "  ${BOLD}Service Type:${NC} HTTP"
            echo -e "  ${BOLD}Service URL:${NC}  nginx:80"
            echo ""
        else
            echo -e "  ${WARN} No token provided. Cloudflare Tunnel will be disabled."
            CFG_USE_CF_TUNNEL="false"
        fi
    else
        CFG_CF_TUNNEL_TOKEN=""
    fi

    # --- MinIO Console Exposure ---
    echo -e "${CYAN}MinIO Console (Storage Administration)${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 50))${NC}"
    echo -e "${DIM}Expose MinIO Console for storage management?${NC}"
    echo -e "${DIM}Only needed for debugging or manual file management.${NC}"
    local minio_console_default="n"
    [ "$EXPOSE_MINIO_CONSOLE" = "true" ] && minio_console_default="y"
    prompt_yesno "Expose MinIO Console?" "$minio_console_default" CFG_EXPOSE_MINIO_CONSOLE
    if [ "$CFG_EXPOSE_MINIO_CONSOLE" = "true" ]; then
        prompt_input "MinIO Console port" "${MINIO_CONSOLE_PORT:-9001}" CFG_MINIO_CONSOLE_PORT
    else
        CFG_MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-9001}"
    fi
    echo ""

    # Step 3: Security keys (individual configuration)
    step "Security keys..."
    echo ""

    echo -e "${CYAN}Security Keys${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 50))${NC}"
    echo -e "${DIM}These keys are critical for data security and session management.${NC}"
    echo -e "${YELLOW}Warning: Changing keys may invalidate existing data or sessions.${NC}"
    echo ""

    prompt_secret "JWT_SECRET (session tokens)" \
        "$JWT_SECRET" CFG_JWT_SECRET \
        "generate_secret_key 64" \
        "Changing this will invalidate all user sessions"

    prompt_secret "ENCRYPTION_KEY (data encryption)" \
        "$ENCRYPTION_KEY" CFG_ENCRYPTION_KEY \
        "generate_secret_key 32" \
        "Changing this may make existing encrypted data unreadable"

    prompt_secret "IMAGE_ENCRYPTION_KEY" \
        "$IMAGE_ENCRYPTION_KEY" CFG_IMAGE_ENCRYPTION_KEY \
        "generate_secret_key 32" \
        "Changing this may make existing encrypted images unreadable"

    prompt_secret "MESSAGE_ENCRYPTION_KEY (DM encryption)" \
        "$MESSAGE_ENCRYPTION_KEY" CFG_MESSAGE_ENCRYPTION_KEY \
        "generate_secret_key 32" \
        "Changing this may make existing encrypted DMs unreadable"

    prompt_secret "IMAGE_SIGNING_KEY (signed URLs)" \
        "$IMAGE_SIGNING_KEY" CFG_IMAGE_SIGNING_KEY \
        "generate_secret_key 32" \
        "Changing this will invalidate all existing signed image URLs"

    # --- Bluesky OAuth ---
    echo -e "${CYAN}Bluesky OAuth${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 50))${NC}"
    echo -e "${DIM}JWK (JSON Web Key) for Bluesky OAuth authentication.${NC}"
    echo ""

    prompt_secret "BLUESKY_OAUTH_PRIVATE_JWK" \
        "$BLUESKY_OAUTH_PRIVATE_JWK" CFG_BLUESKY_OAUTH_PRIVATE_JWK \
        "node \"$PROJECT_ROOT/scripts/js/generate-bluesky-jwks.js\"" \
        "Changing this will require all Bluesky users to re-authenticate"

    # --- Patreon OAuth (Monetization) ---
    echo -e "${CYAN}Patreon Integration (Monetization)${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 50))${NC}"
    echo -e "${DIM}Enable Patreon supporter tiers and automatic tier sync?${NC}"
    echo ""
    local patreon_default="n"
    [ -n "$PATREON_CLIENT_ID" ] && patreon_default="y"
    prompt_yesno "Configure Patreon OAuth?" "$patreon_default" CFG_CONFIGURE_PATREON

    if [ "$CFG_CONFIGURE_PATREON" = "true" ]; then
        echo ""
        echo -e "  ${DIM}Get your credentials from:${NC}"
        echo -e "  ${DIM}https://www.patreon.com/portal/registration/register-clients${NC}"
        echo ""
        prompt_token "Patreon Client ID" \
            "$PATREON_CLIENT_ID" CFG_PATREON_CLIENT_ID \
            "Your Patreon OAuth Client ID"
        prompt_token "Patreon Client Secret" \
            "$PATREON_CLIENT_SECRET" CFG_PATREON_CLIENT_SECRET \
            "Your Patreon OAuth Client Secret"

        # Derive redirect URI from BASE_URL
        CFG_PATREON_REDIRECT_URI="${CFG_BASE_URL}/settings/patreon/callback"
        echo -e "  ${DIM}Redirect URI (set in Patreon): ${CFG_PATREON_REDIRECT_URI}${NC}"
        echo ""

        prompt_token "Patreon Creator Access Token" \
            "$PATREON_CREATOR_ACCESS_TOKEN" CFG_PATREON_CREATOR_ACCESS_TOKEN \
            "Creator Access Token from Patreon Creator Portal (for webhooks)"
    else
        CFG_PATREON_CLIENT_ID=""
        CFG_PATREON_CLIENT_SECRET=""
        CFG_PATREON_REDIRECT_URI=""
        CFG_PATREON_CREATOR_ACCESS_TOKEN=""
    fi
    echo ""

    # --- Instance Contact Information ---
    echo -e "${CYAN}Instance Contact Information${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 50))${NC}"
    echo -e "${DIM}Contact information displayed to users in the Account settings.${NC}"
    echo ""
    prompt_input "Contact info (email/URL/text)" "${INSTANCE_CONTACT_INFO:-}" CFG_INSTANCE_CONTACT_INFO
    echo -e "${DIM}Admin username for direct user link (without @, optional):${NC}"
    prompt_input "Admin username" "${INSTANCE_ADMIN_USERNAME:-}" CFG_INSTANCE_ADMIN_USERNAME
    echo ""

    # Step 4: Show configuration summary
    step "Configuration Summary"
    echo ""

    echo -e "${BOLD}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║${NC}                    ${BOLD}Configuration Summary${NC}                          ${BOLD}║${NC}"
    echo -e "${BOLD}╠════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC} ${CYAN}Instance:${NC}                                                        ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   Name:              $CFG_INSTANCE_NAME$(printf '%*s' $((42 - ${#CFG_INSTANCE_NAME})) "")${BOLD}║${NC}"
    local tagline_display="${CFG_INSTANCE_TAGLINE:-${DIM}(not set)${NC}}"
    local tagline_len=${#CFG_INSTANCE_TAGLINE}
    [ -z "$CFG_INSTANCE_TAGLINE" ] && tagline_len=9
    echo -e "${BOLD}║${NC}   Tagline:           $tagline_display$(printf '%*s' $((42 - tagline_len)) "")${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   BASE_URL:          $CFG_BASE_URL$(printf '%*s' $((42 - ${#CFG_BASE_URL})) "")${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   INSTANCE_ID:       $CFG_INSTANCE_ID$(printf '%*s' $((42 - ${#CFG_INSTANCE_ID})) "")${BOLD}║${NC}"
    echo -e "${BOLD}╠════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC} ${CYAN}Database:${NC}                                                        ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   User:              $CFG_POSTGRES_USER$(printf '%*s' $((42 - ${#CFG_POSTGRES_USER})) "")${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   Database:          $CFG_POSTGRES_DB$(printf '%*s' $((42 - ${#CFG_POSTGRES_DB})) "")${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   Password:          ${CFG_POSTGRES_PASSWORD:0:8}...$(printf '%*s' 31 "")${BOLD}║${NC}"
    echo -e "${BOLD}╠════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC} ${CYAN}Object Storage:${NC}                                                  ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   Admin User:        $CFG_MINIO_USER$(printf '%*s' $((42 - ${#CFG_MINIO_USER})) "")${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   Password:          ${CFG_MINIO_PASSWORD:0:8}...$(printf '%*s' 31 "")${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   Bucket:            $CFG_S3_BUCKET$(printf '%*s' $((42 - ${#CFG_S3_BUCKET})) "")${BOLD}║${NC}"
    echo -e "${BOLD}╠════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC} ${CYAN}Email:${NC}                                                           ${BOLD}║${NC}"
    if [ "$CFG_CONFIGURE_SMTP" = "true" ]; then
        echo -e "${BOLD}║${NC}   SMTP Host:         $CFG_SMTP_HOST$(printf '%*s' $((42 - ${#CFG_SMTP_HOST})) "")${BOLD}║${NC}"
        echo -e "${BOLD}║${NC}   From:              $CFG_MAIL_FROM$(printf '%*s' $((42 - ${#CFG_MAIL_FROM})) "")${BOLD}║${NC}"
    else
        echo -e "${BOLD}║${NC}   ${DIM}Not configured (can be set later)${NC}$(printf '%*s' 27 "")${BOLD}║${NC}"
    fi
    echo -e "${BOLD}╠════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC} ${CYAN}Cloudflare Tunnel:${NC}                                               ${BOLD}║${NC}"
    if [ "$CFG_USE_CF_TUNNEL" = "true" ]; then
        echo -e "${BOLD}║${NC}   ${GREEN}Enabled${NC} - Token configured                                     ${BOLD}║${NC}"
        echo -e "${BOLD}║${NC}   Service URL: nginx:80                                          ${BOLD}║${NC}"
    else
        echo -e "${BOLD}║${NC}   ${DIM}Not configured (can be set later)${NC}$(printf '%*s' 27 "")${BOLD}║${NC}"
    fi
    echo -e "${BOLD}╠════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC} ${CYAN}Security Keys:${NC}                                                   ${BOLD}║${NC}"
    # Helper function to format status
    format_key_status() {
        case "$1" in
            kept) echo -e "${DIM}Kept${NC}" ;;
            generated) echo -e "${GREEN}Generated${NC}" ;;
            manual) echo -e "${CYAN}Manual${NC}" ;;
            *) echo -e "${YELLOW}Unknown${NC}" ;;
        esac
    }
    echo -e "${BOLD}║${NC}   JWT_SECRET:           $(format_key_status "$CFG_JWT_SECRET_STATUS")$(printf '%*s' 31 "")${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   ENCRYPTION_KEY:       $(format_key_status "$CFG_ENCRYPTION_KEY_STATUS")$(printf '%*s' 31 "")${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   IMAGE_ENCRYPTION_KEY: $(format_key_status "$CFG_IMAGE_ENCRYPTION_KEY_STATUS")$(printf '%*s' 31 "")${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   MESSAGE_ENCRYPTION:   $(format_key_status "$CFG_MESSAGE_ENCRYPTION_KEY_STATUS")$(printf '%*s' 31 "")${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   IMAGE_SIGNING_KEY:    $(format_key_status "$CFG_IMAGE_SIGNING_KEY_STATUS")$(printf '%*s' 31 "")${BOLD}║${NC}"
    echo -e "${BOLD}╠════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC} ${CYAN}Bluesky OAuth:${NC}                                                   ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}   JWK:                  $(format_key_status "$CFG_BLUESKY_OAUTH_PRIVATE_JWK_STATUS")$(printf '%*s' 31 "")${BOLD}║${NC}"
    echo -e "${BOLD}╠════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC} ${CYAN}Patreon Integration:${NC}                                             ${BOLD}║${NC}"
    if [ "$CFG_CONFIGURE_PATREON" = "true" ]; then
        echo -e "${BOLD}║${NC}   ${GREEN}Configured${NC} - OAuth credentials set                            ${BOLD}║${NC}"
    else
        echo -e "${BOLD}║${NC}   ${DIM}Not configured (can be set later)${NC}$(printf '%*s' 27 "")${BOLD}║${NC}"
    fi
    echo -e "${BOLD}╠════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC} ${CYAN}Instance Contact:${NC}                                                ${BOLD}║${NC}"
    if [ -n "$CFG_INSTANCE_CONTACT_INFO" ]; then
        local contact_display="${CFG_INSTANCE_CONTACT_INFO:0:40}"
        echo -e "${BOLD}║${NC}   Contact:           $contact_display$(printf '%*s' $((42 - ${#contact_display})) "")${BOLD}║${NC}"
    else
        echo -e "${BOLD}║${NC}   Contact:           ${DIM}Not set${NC}$(printf '%*s' 34 "")${BOLD}║${NC}"
    fi
    if [ -n "$CFG_INSTANCE_ADMIN_USERNAME" ]; then
        echo -e "${BOLD}║${NC}   Admin:             @$CFG_INSTANCE_ADMIN_USERNAME$(printf '%*s' $((41 - ${#CFG_INSTANCE_ADMIN_USERNAME})) "")${BOLD}║${NC}"
    else
        echo -e "${BOLD}║${NC}   Admin:             ${DIM}Not set${NC}$(printf '%*s' 34 "")${BOLD}║${NC}"
    fi
    echo -e "${BOLD}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Confirm before writing
    read -p "  Proceed with this configuration? (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        print_warning "Setup cancelled. Run './install.sh setup-env' to try again."
        exit 0
    fi
    echo ""

    # Step 5: Write configuration
    step "Writing configuration to .env..."

    start_spinner "Writing configuration..."

    # Write all configuration values
    set_env_var "INSTANCE_NAME" "$CFG_INSTANCE_NAME" "$ENV_FILE"
    set_env_var "INSTANCE_TAGLINE" "$CFG_INSTANCE_TAGLINE" "$ENV_FILE"
    set_env_var "BASE_URL" "$CFG_BASE_URL" "$ENV_FILE"
    set_env_var "FRONTEND_URL" "$CFG_FRONTEND_URL" "$ENV_FILE"
    set_env_var "MINIO_PUBLIC_URL" "$CFG_MINIO_PUBLIC_URL" "$ENV_FILE"
    set_env_var "INSTANCE_ID" "$CFG_INSTANCE_ID" "$ENV_FILE"
    set_env_var "NUXT_PUBLIC_INSTANCE_ID" "$CFG_INSTANCE_ID" "$ENV_FILE"

    set_env_var "POSTGRES_USER" "$CFG_POSTGRES_USER" "$ENV_FILE"
    set_env_var "POSTGRES_DB" "$CFG_POSTGRES_DB" "$ENV_FILE"
    set_env_var "POSTGRES_PASSWORD" "$CFG_POSTGRES_PASSWORD" "$ENV_FILE"

    set_env_var "MINIO_ROOT_USER" "$CFG_MINIO_USER" "$ENV_FILE"
    set_env_var "MINIO_ROOT_PASSWORD" "$CFG_MINIO_PASSWORD" "$ENV_FILE"
    set_env_var "S3_BUCKET" "$CFG_S3_BUCKET" "$ENV_FILE"

    if [ "$CFG_CONFIGURE_SMTP" = "true" ]; then
        set_env_var "SMTP_HOST" "$CFG_SMTP_HOST" "$ENV_FILE"
        set_env_var "SMTP_PORT" "$CFG_SMTP_PORT" "$ENV_FILE"
        set_env_var "SMTP_SECURE" "$CFG_SMTP_SECURE" "$ENV_FILE"
        set_env_var "SMTP_USER" "$CFG_SMTP_USER" "$ENV_FILE"
        set_env_var "SMTP_PASS" "$CFG_SMTP_PASS" "$ENV_FILE"
        set_env_var "MAIL_FROM" "$CFG_MAIL_FROM" "$ENV_FILE"
    fi

    set_env_var "NGINX_PORT" "$CFG_NGINX_PORT" "$ENV_FILE"

    # Write Cloudflare Tunnel settings
    if [ "$CFG_USE_CF_TUNNEL" = "true" ]; then
        set_env_var "CLOUDFLARE_TUNNEL_ENABLED" "true" "$ENV_FILE"
        set_env_var "CLOUDFLARE_TUNNEL_TOKEN" "$CFG_CF_TUNNEL_TOKEN" "$ENV_FILE"
    else
        set_env_var "CLOUDFLARE_TUNNEL_ENABLED" "false" "$ENV_FILE"
        set_env_var "CLOUDFLARE_TUNNEL_TOKEN" "" "$ENV_FILE"
    fi

    # Write MinIO Console settings
    if [ "$CFG_EXPOSE_MINIO_CONSOLE" = "true" ]; then
        set_env_var "EXPOSE_MINIO_CONSOLE" "true" "$ENV_FILE"
        set_env_var "MINIO_CONSOLE_PORT" "$CFG_MINIO_CONSOLE_PORT" "$ENV_FILE"
    else
        set_env_var "EXPOSE_MINIO_CONSOLE" "false" "$ENV_FILE"
    fi

    # Write security keys
    set_env_var "JWT_SECRET" "$CFG_JWT_SECRET" "$ENV_FILE"
    set_env_var "ENCRYPTION_KEY" "$CFG_ENCRYPTION_KEY" "$ENV_FILE"
    set_env_var "IMAGE_ENCRYPTION_KEY" "$CFG_IMAGE_ENCRYPTION_KEY" "$ENV_FILE"
    set_env_var "MESSAGE_ENCRYPTION_KEY" "$CFG_MESSAGE_ENCRYPTION_KEY" "$ENV_FILE"
    set_env_var "IMAGE_SIGNING_KEY" "$CFG_IMAGE_SIGNING_KEY" "$ENV_FILE"
    set_env_var "IMAGE_SIGNED_URL_ENABLED" "true" "$ENV_FILE"
    set_env_var "IMAGE_SIGNED_URL_EXPIRES" "300" "$ENV_FILE"
    set_env_var "IMAGE_HOTLINK_PROTECTION" "true" "$ENV_FILE"
    set_env_var "BLUESKY_OAUTH_PRIVATE_JWK" "$CFG_BLUESKY_OAUTH_PRIVATE_JWK" "$ENV_FILE"

    # Write Patreon OAuth settings
    if [ "$CFG_CONFIGURE_PATREON" = "true" ]; then
        set_env_var "PATREON_CLIENT_ID" "$CFG_PATREON_CLIENT_ID" "$ENV_FILE"
        set_env_var "PATREON_CLIENT_SECRET" "$CFG_PATREON_CLIENT_SECRET" "$ENV_FILE"
        set_env_var "PATREON_REDIRECT_URI" "$CFG_PATREON_REDIRECT_URI" "$ENV_FILE"
        set_env_var "PATREON_CREATOR_ACCESS_TOKEN" "$CFG_PATREON_CREATOR_ACCESS_TOKEN" "$ENV_FILE"
    else
        set_env_var "PATREON_CLIENT_ID" "" "$ENV_FILE"
        set_env_var "PATREON_CLIENT_SECRET" "" "$ENV_FILE"
        set_env_var "PATREON_REDIRECT_URI" "" "$ENV_FILE"
        set_env_var "PATREON_CREATOR_ACCESS_TOKEN" "" "$ENV_FILE"
    fi

    # Write instance contact information
    set_env_var "INSTANCE_CONTACT_INFO" "$CFG_INSTANCE_CONTACT_INFO" "$ENV_FILE"
    set_env_var "INSTANCE_ADMIN_USERNAME" "$CFG_INSTANCE_ADMIN_USERNAME" "$ENV_FILE"

    set_env_var "NODE_ENV" "production" "$ENV_FILE"

    stop_spinner true "Configuration written"
    echo ""

    # Step 6: Display newly generated keys with warning
    local has_new_keys=false
    if [ "$CFG_JWT_SECRET_STATUS" = "generated" ] || \
       [ "$CFG_ENCRYPTION_KEY_STATUS" = "generated" ] || \
       [ "$CFG_IMAGE_ENCRYPTION_KEY_STATUS" = "generated" ] || \
       [ "$CFG_MESSAGE_ENCRYPTION_KEY_STATUS" = "generated" ] || \
       [ "$CFG_IMAGE_SIGNING_KEY_STATUS" = "generated" ] || \
       [ "$CFG_BLUESKY_OAUTH_PRIVATE_JWK_STATUS" = "generated" ] || \
       [ "$CFG_POSTGRES_PASSWORD_STATUS" = "generated" ] || \
       [ "$CFG_MINIO_PASSWORD_STATUS" = "generated" ]; then
        has_new_keys=true
    fi

    if [ "$has_new_keys" = "true" ]; then
        step "Displaying generated keys (SAVE THESE!)..."

        print_box "IMPORTANT: NEWLY GENERATED SECRETS"
        print_box_line "The following secrets were newly generated."
        print_box_line "Please save them in a secure location (password manager, etc.)"
        print_box_line ""
        print_box_line "${YELLOW}WARNING: These values will NOT be shown again!${NC}"
        echo -e "${BOLD}╠$(printf '═%.0s' $(seq 1 68))╣${NC}"
        print_box_line ""

        if [ "$CFG_JWT_SECRET_STATUS" = "generated" ]; then
            print_box_line "${CYAN}JWT_SECRET:${NC}"
            print_box_line "  ${CFG_JWT_SECRET:0:32}..."
            print_box_line ""
        fi
        if [ "$CFG_ENCRYPTION_KEY_STATUS" = "generated" ]; then
            print_box_line "${CYAN}ENCRYPTION_KEY:${NC}"
            print_box_line "  $CFG_ENCRYPTION_KEY"
            print_box_line ""
        fi
        if [ "$CFG_IMAGE_ENCRYPTION_KEY_STATUS" = "generated" ]; then
            print_box_line "${CYAN}IMAGE_ENCRYPTION_KEY:${NC}"
            print_box_line "  $CFG_IMAGE_ENCRYPTION_KEY"
            print_box_line ""
        fi
        if [ "$CFG_MESSAGE_ENCRYPTION_KEY_STATUS" = "generated" ]; then
            print_box_line "${CYAN}MESSAGE_ENCRYPTION_KEY:${NC}"
            print_box_line "  $CFG_MESSAGE_ENCRYPTION_KEY"
            print_box_line ""
        fi
        if [ "$CFG_IMAGE_SIGNING_KEY_STATUS" = "generated" ]; then
            print_box_line "${CYAN}IMAGE_SIGNING_KEY:${NC}"
            print_box_line "  $CFG_IMAGE_SIGNING_KEY"
            print_box_line ""
        fi
        if [ "$CFG_BLUESKY_OAUTH_PRIVATE_JWK_STATUS" = "generated" ]; then
            print_box_line "${CYAN}BLUESKY_OAUTH_PRIVATE_JWK:${NC}"
            print_box_line "  ${CFG_BLUESKY_OAUTH_PRIVATE_JWK:0:40}..."
            print_box_line ""
        fi
        if [ "$CFG_POSTGRES_PASSWORD_STATUS" = "generated" ]; then
            print_box_line "${CYAN}POSTGRES_PASSWORD:${NC}"
            print_box_line "  $CFG_POSTGRES_PASSWORD"
            print_box_line ""
        fi
        if [ "$CFG_MINIO_PASSWORD_STATUS" = "generated" ]; then
            print_box_line "${CYAN}MINIO_ROOT_PASSWORD:${NC}"
            print_box_line "  $CFG_MINIO_PASSWORD"
            print_box_line ""
        fi

        echo -e "${BOLD}╠$(printf '═%.0s' $(seq 1 68))╣${NC}"
        print_box_line "Configuration saved to: ${GREEN}$ENV_FILE${NC}"
        print_box_line ""
        print_box_line "To export keys for backup:"
        print_box_line "  ${CYAN}./install.sh export-keys > keys-backup.txt${NC}"
        print_box_end

        read -p "Press Enter after saving these keys..."
    else
        step_done "Configuration saved to $ENV_FILE"
    fi

    # Final instructions
    echo ""
    echo -e "${BOLD}${GREEN}Setup complete!${NC}"
    echo ""
    echo -e "Next steps:"
    echo -e "  ${ARROW} Validate config:    ${CYAN}./install.sh check-env${NC}"
    echo -e "  ${ARROW} Start services:     ${CYAN}./install.sh start${NC}"
    echo ""
    echo -e "${DIM}Access your instance at: $CFG_BASE_URL${NC}"
}
