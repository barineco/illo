# check-env.sh - Environment validation command
# This file is sourced by install.sh - do not execute directly

# Internal validation function that returns status instead of exiting
# Returns: 0 = OK, 1 = has warnings, 2 = has errors
_validate_env() {
    local has_errors=false
    local has_warnings=false

    if [ ! -f "$ENV_FILE" ]; then
        print_error "Production environment file not found: $ENV_FILE"
        print_info "Run './install.sh setup-env' to create it."
        return 2
    fi

    load_env

    # Required variables
    echo -e "${CYAN}Required Variables${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 40))${NC}"

    local required_vars=("JWT_SECRET" "ENCRYPTION_KEY" "BASE_URL")
    for var in "${required_vars[@]}"; do
        local value="${!var}"
        if [ -z "$value" ]; then
            echo -e "  ${CROSS} $var ${DIM}(not set)${NC}"
            has_errors=true
        elif [[ "$value" == *"CHANGE"* ]]; then
            echo -e "  ${CROSS} $var ${DIM}(placeholder value)${NC}"
            has_errors=true
        else
            echo -e "  ${CHECK} $var"
        fi
    done
    echo ""

    # Recommended variables
    echo -e "${CYAN}Recommended Variables${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 40))${NC}"

    local recommended_vars=("IMAGE_ENCRYPTION_KEY" "MESSAGE_ENCRYPTION_KEY" "IMAGE_SIGNING_KEY" "INSTANCE_ID" "MINIO_PUBLIC_URL")
    for var in "${recommended_vars[@]}"; do
        local value="${!var}"
        if [ -z "$value" ]; then
            echo -e "  ${WARN} $var ${DIM}(not set)${NC}"
            has_warnings=true
        elif [[ "$value" == *"CHANGE"* ]]; then
            echo -e "  ${WARN} $var ${DIM}(placeholder value)${NC}"
            has_warnings=true
        else
            echo -e "  ${CHECK} $var"
        fi
    done
    echo ""

    # Security check
    echo -e "${CYAN}Security Check${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 40))${NC}"

    if [ -n "$POSTGRES_PASSWORD" ] && [ ${#POSTGRES_PASSWORD} -lt 16 ]; then
        echo -e "  ${WARN} POSTGRES_PASSWORD ${DIM}(< 16 characters)${NC}"
        has_warnings=true
    else
        echo -e "  ${CHECK} POSTGRES_PASSWORD length"
    fi

    if [ -n "$MINIO_ROOT_PASSWORD" ] && [ ${#MINIO_ROOT_PASSWORD} -lt 16 ]; then
        echo -e "  ${WARN} MINIO_ROOT_PASSWORD ${DIM}(< 16 characters)${NC}"
        has_warnings=true
    else
        echo -e "  ${CHECK} MINIO_ROOT_PASSWORD length"
    fi

    if [ -n "$BASE_URL" ]; then
        if [[ "$BASE_URL" == http://* ]] && [[ "$BASE_URL" != *"localhost"* ]]; then
            echo -e "  ${WARN} BASE_URL ${DIM}(using HTTP instead of HTTPS)${NC}"
            has_warnings=true
        else
            echo -e "  ${CHECK} BASE_URL protocol"
        fi
    fi
    echo ""

    # SMTP configuration
    echo -e "${CYAN}Email Configuration${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 40))${NC}"

    if [ -z "$SMTP_HOST" ]; then
        echo -e "  ${WARN} SMTP not configured ${DIM}(email disabled)${NC}"
        has_warnings=true
    else
        echo -e "  ${CHECK} SMTP: $SMTP_HOST:${SMTP_PORT:-587}"
    fi
    echo ""

    # Summary
    echo -e "${DIM}$(printf '═%.0s' $(seq 1 40))${NC}"
    if [ "$has_errors" = true ]; then
        echo -e "${RED}${BOLD}Configuration has errors that must be fixed.${NC}"
        return 2
    elif [ "$has_warnings" = true ]; then
        echo -e "${YELLOW}${BOLD}Configuration has warnings. Review before production.${NC}"
        return 1
    else
        echo -e "${GREEN}${BOLD}Configuration looks good!${NC}"
        return 0
    fi
}

cmd_check_env() {
    echo ""
    echo -e "${BOLD}Validating Environment Configuration${NC}"
    echo ""

    local has_errors=false
    local has_warnings=false

    if [ ! -f "$ENV_FILE" ]; then
        print_error "Production environment file not found: $ENV_FILE"
        print_info "Run './install.sh setup-env' to create it."
        exit 1
    fi

    load_env

    # Required variables
    echo -e "${CYAN}Required Variables${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 40))${NC}"

    local required_vars=("JWT_SECRET" "ENCRYPTION_KEY" "BASE_URL")
    for var in "${required_vars[@]}"; do
        local value="${!var}"
        if [ -z "$value" ]; then
            echo -e "  ${CROSS} $var ${DIM}(not set)${NC}"
            has_errors=true
        elif [[ "$value" == *"CHANGE"* ]]; then
            echo -e "  ${CROSS} $var ${DIM}(placeholder value)${NC}"
            has_errors=true
        else
            echo -e "  ${CHECK} $var"
        fi
    done
    echo ""

    # Recommended variables
    echo -e "${CYAN}Recommended Variables${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 40))${NC}"

    local recommended_vars=("IMAGE_ENCRYPTION_KEY" "MESSAGE_ENCRYPTION_KEY" "IMAGE_SIGNING_KEY" "INSTANCE_ID" "MINIO_PUBLIC_URL")
    for var in "${recommended_vars[@]}"; do
        local value="${!var}"
        if [ -z "$value" ]; then
            echo -e "  ${WARN} $var ${DIM}(not set)${NC}"
            has_warnings=true
        elif [[ "$value" == *"CHANGE"* ]]; then
            echo -e "  ${WARN} $var ${DIM}(placeholder value)${NC}"
            has_warnings=true
        else
            echo -e "  ${CHECK} $var"
        fi
    done
    echo ""

    # Security check
    echo -e "${CYAN}Security Check${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 40))${NC}"

    if [ -n "$POSTGRES_PASSWORD" ] && [ ${#POSTGRES_PASSWORD} -lt 16 ]; then
        echo -e "  ${WARN} POSTGRES_PASSWORD ${DIM}(< 16 characters)${NC}"
        has_warnings=true
    else
        echo -e "  ${CHECK} POSTGRES_PASSWORD length"
    fi

    if [ -n "$MINIO_ROOT_PASSWORD" ] && [ ${#MINIO_ROOT_PASSWORD} -lt 16 ]; then
        echo -e "  ${WARN} MINIO_ROOT_PASSWORD ${DIM}(< 16 characters)${NC}"
        has_warnings=true
    else
        echo -e "  ${CHECK} MINIO_ROOT_PASSWORD length"
    fi

    if [ -n "$BASE_URL" ]; then
        if [[ "$BASE_URL" == http://* ]] && [[ "$BASE_URL" != *"localhost"* ]]; then
            echo -e "  ${WARN} BASE_URL ${DIM}(using HTTP instead of HTTPS)${NC}"
            has_warnings=true
        else
            echo -e "  ${CHECK} BASE_URL protocol"
        fi
    fi
    echo ""

    # SMTP configuration
    echo -e "${CYAN}Email Configuration${NC}"
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 40))${NC}"

    if [ -z "$SMTP_HOST" ]; then
        echo -e "  ${WARN} SMTP not configured ${DIM}(email disabled)${NC}"
        has_warnings=true
    else
        echo -e "  ${CHECK} SMTP: $SMTP_HOST:${SMTP_PORT:-587}"
    fi
    echo ""

    # Summary
    echo -e "${DIM}$(printf '═%.0s' $(seq 1 40))${NC}"
    if [ "$has_errors" = true ]; then
        echo -e "${RED}${BOLD}Configuration has errors that must be fixed.${NC}"
        exit 1
    elif [ "$has_warnings" = true ]; then
        echo -e "${YELLOW}${BOLD}Configuration has warnings. Review before production.${NC}"
    else
        echo -e "${GREEN}${BOLD}Configuration looks good!${NC}"
    fi
    echo ""
}
