# common.sh - Color codes, path definitions, and constants
# This file is sourced by install.sh - do not execute directly

################################################################################
# Application Identity
################################################################################

# Application Name (change this if renaming the project)
APP_NAME="illo"

################################################################################
# Color Codes
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

################################################################################
# Unicode Symbols
################################################################################

CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
ARROW="${CYAN}→${NC}"
WARN="${YELLOW}!${NC}"

################################################################################
# Path Configuration
################################################################################

# Note: PROJECT_ROOT is defined in the main install.sh before sourcing this file
ENV_EXAMPLE_FILE="$PROJECT_ROOT/.env.example"
ENV_FILE="$PROJECT_ROOT/.env"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
BACKUP_DIR="$PROJECT_ROOT/backups"
NGINX_CONFIG="$PROJECT_ROOT/nginx/nginx.prod.conf"

################################################################################
# Docker Compose Configuration
################################################################################

COMPOSE_PROJECT="${APP_NAME}"
