# fix-env.sh - Environment file maintenance commands
# This file is sourced by install.sh - do not execute directly

################################################################################
# Reorder .env to match .env.example structure
################################################################################

# Internal function for automated use (no confirmation prompt)
# Returns: 0 = success, 1 = error
_fix_env_silent() {
    if [ ! -f "$ENV_FILE" ]; then
        return 1
    fi

    if [ ! -f "$ENV_EXAMPLE_FILE" ]; then
        return 1
    fi

    # Create backup
    local backup_file="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$ENV_FILE" "$backup_file"

    # Reorder
    reorder_env_file "$ENV_EXAMPLE_FILE" "$ENV_FILE"

    return 0
}

cmd_fix_env() {
    echo ""
    echo -e "${BOLD}Environment File Maintenance${NC}"
    echo ""

    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file not found: $ENV_FILE"
        echo -e "${DIM}Run './install.sh setup-env' first to create the configuration.${NC}"
        exit 1
    fi

    if [ ! -f "$ENV_EXAMPLE_FILE" ]; then
        print_error "Template file not found: $ENV_EXAMPLE_FILE"
        exit 1
    fi

    echo -e "${DIM}This will reorder your .env file to match .env.example structure.${NC}"
    echo -e "${DIM}Your values will be preserved, only the order will change.${NC}"
    echo ""

    read -p "Continue? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cancelled."
        return
    fi

    # Create backup
    local backup_file="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$ENV_FILE" "$backup_file"
    step_done "Backup created: $backup_file"

    start_spinner "Reordering environment variables..."
    reorder_env_file "$ENV_EXAMPLE_FILE" "$ENV_FILE"
    stop_spinner
    step_done "Environment file reordered"

    echo ""
    print_success "Environment file has been reorganized."
    echo -e "${DIM}Backup saved to: $backup_file${NC}"
    echo ""
}

################################################################################
# Reorder .env file based on template
################################################################################

reorder_env_file() {
    local template_file="$1"
    local target_file="$2"
    local temp_file="${target_file}.reorder.tmp"

    # Read all current values (key=value pairs from target file)
    # Store in a simple format: one "KEY=VALUE" per line in a temp file
    local values_file="${target_file}.values.tmp"
    > "$values_file"

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi

        # Parse KEY=VALUE and store
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)= ]]; then
            echo "$line" >> "$values_file"
        fi
    done < "$target_file"

    # Track which keys we've written
    local written_file="${target_file}.written.tmp"
    > "$written_file"

    # Process template file and write output
    > "$temp_file"

    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ -z "$line" ]]; then
            # Empty line - preserve
            echo "" >> "$temp_file"
        elif [[ "$line" =~ ^[[:space:]]*# ]]; then
            # Comment line - preserve
            echo "$line" >> "$temp_file"
        elif [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"

            # Check if key exists in current values
            local current_line
            current_line=$(grep "^${key}=" "$values_file" 2>/dev/null | head -1) || true

            if [ -n "$current_line" ]; then
                # Key exists in current .env - use current value
                echo "$current_line" >> "$temp_file"
            else
                # Key doesn't exist - use template default
                echo "$line" >> "$temp_file"
            fi
            echo "$key" >> "$written_file"
        else
            # Other lines - preserve as-is
            echo "$line" >> "$temp_file"
        fi
    done < "$template_file"

    # Append any keys from current .env that weren't in template
    local has_extra=false
    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)= ]]; then
            local key="${BASH_REMATCH[1]}"

            # Check if already written
            if ! grep -q "^${key}$" "$written_file" 2>/dev/null; then
                if [ "$has_extra" = false ]; then
                    echo "" >> "$temp_file"
                    echo "################################################################################" >> "$temp_file"
                    echo "# Additional Variables (not in template)" >> "$temp_file"
                    echo "################################################################################" >> "$temp_file"
                    has_extra=true
                fi
                echo "$line" >> "$temp_file"
            fi
        fi
    done < "$values_file"

    # Replace original file
    mv "$temp_file" "$target_file"

    # Cleanup temp files
    rm -f "$values_file" "$written_file"
}
