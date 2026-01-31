# utils.sh - Utility functions (secret generation, env management, prompts)
# This file is sourced by install.sh - do not execute directly

################################################################################
# Secret Key Generation
################################################################################

generate_secret_key() {
    local bytes="${1:-32}"
    node -e "console.log(require('crypto').randomBytes($bytes).toString('hex'))"
}

################################################################################
# Environment File Management
################################################################################

check_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Production environment file not found: $ENV_FILE"
        print_info "Run './install.sh install' to set up the production environment"
        exit 1
    fi
}

load_env() {
    if [ -f "$ENV_FILE" ]; then
        set -a
        source "$ENV_FILE"
        set +a
    fi
}

################################################################################
# Interactive Prompts
################################################################################

# Prompt for input with default value
prompt_input() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    local result

    if [ -n "$default" ]; then
        read -p "  $prompt [${default}]: " result
        result="${result:-$default}"
    else
        read -p "  $prompt: " result
    fi
    eval "$var_name='$result'"
}

# Prompt for password (hidden input) with auto-generate option
prompt_password() {
    local prompt="$1"
    local var_name="$2"
    local result

    echo -e "  $prompt"
    echo -e "  ${DIM}(Press Enter to auto-generate a secure password)${NC}"
    read -s -p "  > " result
    echo

    if [ -z "$result" ]; then
        result=$(generate_secret_key 16)
        echo -e "  ${DIM}Auto-generated: ${result}${NC}"
    elif [ ${#result} -lt 16 ]; then
        echo -e "  ${YELLOW}Warning: Password is shorter than 16 characters (recommended)${NC}"
    fi
    eval "$var_name='$result'"
}

# Prompt for secret value with 3 options when existing value exists
# Usage: prompt_secret "Label" "existing_value" "output_var" "generator_cmd" ["warning_message"]
# Returns via output_var and sets ${output_var}_STATUS to: "kept" | "manual" | "generated"
prompt_secret() {
    local label="$1"
    local existing="$2"
    local output_var="$3"
    local generator="$4"
    local warning="$5"

    echo -e "  ${BOLD}$label${NC}"

    if [ -n "$existing" ]; then
        # Show truncated current value
        echo -e "  ${DIM}Current: ${existing:0:8}...${NC}"

        # Show warning if provided
        if [ -n "$warning" ]; then
            echo -e "  ${YELLOW}$warning${NC}"
        fi

        echo -e "  ${DIM}[1] Keep existing (Enter)${NC}"
        echo -e "  ${DIM}[2] Enter new value${NC}"
        if [ -n "$generator" ]; then
            echo -e "  ${DIM}[3] Generate new random value${NC}"
        fi
        read -p "  Choice [1]: " choice

        case "$choice" in
            2)
                read -s -p "  New value: " new_value
                echo
                eval "$output_var=\"\$new_value\""
                eval "${output_var}_STATUS=manual"
                ;;
            3)
                if [ -n "$generator" ]; then
                    local generated
                    generated=$(eval "$generator")
                    eval "$output_var=\"\$generated\""
                    eval "${output_var}_STATUS=generated"
                    echo -e "  ${GREEN}Generated: ${generated:0:16}...${NC}"
                else
                    eval "$output_var=\"\$existing\""
                    eval "${output_var}_STATUS=kept"
                fi
                ;;
            *)
                eval "$output_var=\"\$existing\""
                eval "${output_var}_STATUS=kept"
                echo -e "  ${DIM}Keeping existing value${NC}"
                ;;
        esac
    else
        # No existing value
        echo -e "  ${DIM}[1] Enter value${NC}"
        if [ -n "$generator" ]; then
            echo -e "  ${DIM}[2] Generate random value (Recommended)${NC}"
            read -p "  Choice [2]: " choice
        else
            read -p "  Choice [1]: " choice
            choice="${choice:-1}"
        fi

        case "$choice" in
            1)
                read -s -p "  Value: " new_value
                echo
                eval "$output_var=\"\$new_value\""
                eval "${output_var}_STATUS=manual"
                ;;
            *)
                if [ -n "$generator" ]; then
                    local generated
                    generated=$(eval "$generator")
                    eval "$output_var=\"\$generated\""
                    eval "${output_var}_STATUS=generated"
                    echo -e "  ${GREEN}Generated: ${generated:0:16}...${NC}"
                else
                    echo -e "  ${RED}No value provided${NC}"
                    eval "$output_var=\"\""
                    eval "${output_var}_STATUS=empty"
                fi
                ;;
        esac
    fi
    echo ""
}

# Prompt for external token (no auto-generation option)
# Usage: prompt_token "Label" "existing_value" "output_var" ["instructions"]
# Returns via output_var and sets ${output_var}_STATUS to: "kept" | "manual" | "empty"
prompt_token() {
    local label="$1"
    local existing="$2"
    local output_var="$3"
    local instructions="$4"

    echo -e "  ${BOLD}$label${NC}"

    if [ -n "$instructions" ]; then
        echo -e "  ${DIM}$instructions${NC}"
    fi

    if [ -n "$existing" ]; then
        echo -e "  ${DIM}Current: ${existing:0:16}...${NC}"
        echo -e "  ${DIM}Press Enter to keep existing, or paste new value${NC}"
        read -p "  > " new_value

        if [ -z "$new_value" ]; then
            eval "$output_var=\"\$existing\""
            eval "${output_var}_STATUS=kept"
            echo -e "  ${DIM}Keeping existing value${NC}"
        else
            eval "$output_var=\"\$new_value\""
            eval "${output_var}_STATUS=manual"
        fi
    else
        read -p "  > " new_value
        if [ -n "$new_value" ]; then
            eval "$output_var=\"\$new_value\""
            eval "${output_var}_STATUS=manual"
        else
            eval "$output_var=\"\""
            eval "${output_var}_STATUS=empty"
        fi
    fi
    echo ""
}

# Prompt for yes/no
prompt_yesno() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"

    local hint="y/n"
    [ "$default" = "y" ] && hint="Y/n"
    [ "$default" = "n" ] && hint="y/N"

    read -p "  $prompt [$hint]: " -n 1 -r
    echo

    if [ -z "$REPLY" ]; then
        REPLY="$default"
    fi

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        eval "$var_name=true"
    else
        eval "$var_name=false"
    fi
}

################################################################################
# Environment Variable Manipulation
################################################################################

# Update or add env variable
# Values containing quotes, spaces, or special characters are wrapped in single quotes
set_env_var() {
    local key="$1"
    local value="$2"
    local file="$3"

    # Determine if value needs quoting (contains special chars like ", space, $, etc.)
    local needs_quoting=false
    if [[ "$value" == *'"'* ]] || [[ "$value" == *' '* ]] || [[ "$value" == *'$'* ]] || \
       [[ "$value" == *'{'* ]] || [[ "$value" == *'}'* ]] || [[ "$value" == *'`'* ]]; then
        needs_quoting=true
    fi

    local formatted_value
    if [ "$needs_quoting" = true ]; then
        # Escape single quotes within value: ' -> '\''
        local escaped_value="${value//\'/\'\\\'\'}"
        formatted_value="'${escaped_value}'"
    else
        formatted_value="$value"
    fi

    # Replace existing line in-place or append if not found
    if grep -q "^${key}=" "$file" 2>/dev/null; then
        # Use awk to replace in-place (preserves line position, handles special chars safely)
        awk -v key="$key" -v newval="${key}=${formatted_value}" '
            BEGIN { FS="="; OFS="=" }
            $1 == key { print newval; next }
            { print }
        ' "$file" > "${file}.tmp"
        mv "${file}.tmp" "$file"
    else
        # Append new value if key doesn't exist
        echo "${key}=${formatted_value}" >> "$file"
    fi
}
