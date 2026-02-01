#!/usr/bin/env bash

################################################################################
# install.sh - Production Environment Manager for open-illustboard
#
# This script manages the production deployment using docker-compose.yml.
#
# Usage:
#   ./install.sh setup-env          Configure environment (interactive setup)
#   ./install.sh check-env          Validate environment configuration
#   ./install.sh start              Start all production services
#   ./install.sh stop               Stop all services
#   ./install.sh restart [service] [--force]  Restart services
#   ./install.sh rebuild [service] [--no-cache] [--pull] [--restart]  Rebuild Docker images
#   ./install.sh logs [service]     Show logs
#   ./install.sh status             Check status of all services
#   ./install.sh backup <type>      Create backup (db|full|list)
#   ./install.sh restore <type> [file]  Restore from backup (db|full)
#   ./install.sh export-keys        Export secret keys for backup
#   ./install.sh regenerate-jwk     Regenerate Bluesky OAuth JWK
#   ./install.sh shell <service>    Open shell in a container
#   ./install.sh clean [--volumes] [--images] [--all]  Clean up resources
#   ./install.sh reset              Complete environment reset (data loss!)
#   ./install.sh update             Safe production update
#
################################################################################

set -e

# Project root directory (where this script is located)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Module paths
INSTALL_LIB="${PROJECT_ROOT}/scripts/install/lib"
INSTALL_CMD="${PROJECT_ROOT}/scripts/install/commands"

################################################################################
# Cleanup and Signal Handling
################################################################################

# Cleanup function for graceful exit
cleanup() {
    if [ -n "$SPINNER_PID" ]; then
        kill "$SPINNER_PID" 2>/dev/null || true
        wait "$SPINNER_PID" 2>/dev/null || true
    fi
    tput cnorm 2>/dev/null || true
    printf "\r\033[K" 2>/dev/null || true
}

# Handle interrupt signal (Ctrl+C)
handle_interrupt() {
    cleanup
    echo ""
    echo -e "\033[0;31m[INTERRUPTED]\033[0m Operation cancelled by user"
    exit 130
}

trap cleanup EXIT
trap handle_interrupt INT TERM

################################################################################
# Load Modules
################################################################################

# Library modules
source "${INSTALL_LIB}/common.sh"
source "${INSTALL_LIB}/ui.sh"
source "${INSTALL_LIB}/utils.sh"
source "${INSTALL_LIB}/docker.sh"

# Command modules
source "${INSTALL_CMD}/setup-env.sh"
source "${INSTALL_CMD}/check-env.sh"
source "${INSTALL_CMD}/service.sh"
source "${INSTALL_CMD}/status.sh"
source "${INSTALL_CMD}/logs.sh"
source "${INSTALL_CMD}/backup.sh"
source "${INSTALL_CMD}/keys.sh"
source "${INSTALL_CMD}/shell.sh"
source "${INSTALL_CMD}/fix-env.sh"
source "${INSTALL_CMD}/maintenance.sh"

################################################################################
# Help Function
################################################################################

cmd_help() {
    echo ""
    echo -e "${BOLD}${APP_NAME} Production Manager${NC}"
    echo ""
    echo "Usage: ./install.sh <command> [options]"
    echo ""
    echo -e "${CYAN}Installation & Configuration:${NC}"
    echo "  setup-env            Configure environment (interactive setup)"
    echo "  check-env            Validate environment configuration"
    echo ""
    echo -e "${CYAN}Service Management:${NC}"
    echo "  start                Start all production services"
    echo "  stop                 Stop all services"
    echo "  restart [service] [--force]  Restart all or specific service"
    echo "  rebuild [service] [--no-cache] [--pull] [--restart]  Rebuild Docker images"
    echo ""
    echo -e "${CYAN}Maintenance:${NC}"
    echo "  clean [--volumes] [--images] [--all]  Clean up containers/volumes/images"
    echo "  reset                Complete environment reset (data loss!)"
    echo "  update               Safe production update (backup + rebuild + restart)"
    echo "  maintenance <on|off|status>  Manage maintenance mode"
    echo ""
    echo -e "${CYAN}Monitoring:${NC}"
    echo "  status               Check status of all services"
    echo "  logs [service]       Show logs (all or specific service)"
    echo "  shell <service>      Open shell in a container"
    echo ""
    echo -e "${CYAN}Data Management:${NC}"
    echo "  backup db            Create database-only backup"
    echo "  backup full          Full backup (database + MinIO + .env)"
    echo "  backup list          List available backups"
    echo "  restore db <file>    Restore database from backup"
    echo "  restore full <file>  Full restore from backup"
    echo "  export-keys          Export secret keys for backup"
    echo ""
    echo -e "${CYAN}Security:${NC}"
    echo "  regenerate-jwk       Regenerate Bluesky OAuth JWK (key rotation)"
    echo ""
    echo -e "${CYAN}Utilities:${NC}"
    echo "  fix-env              Reorder .env to match .env.example structure"
    echo ""
    echo -e "${DIM}Services: postgres, redis, minio, backend, frontend, nginx, cloudflared${NC}"
    echo ""
    echo -e "${CYAN}Cloudflare Tunnel:${NC}"
    echo "  When enabled, cloudflared container provides secure public access"
    echo "  with free HTTPS, DDoS protection, and AI/bot crawler blocking."
    echo ""
    echo -e "${CYAN}Quick Start:${NC}"
    echo "  1. ./install.sh setup-env      # Interactive configuration"
    echo "  2. ./install.sh check-env      # Validate configuration"
    echo "  3. ./install.sh start          # Launch services"
    echo ""
}

################################################################################
# Main
################################################################################

COMMAND="${1:-help}"
shift 2>/dev/null || true

case "$COMMAND" in
    setup-env|setup)
        cmd_setup_env
        ;;
    regenerate-jwk)
        cmd_regenerate_jwk "$@"
        ;;
    check-env|check|validate)
        cmd_check_env
        ;;
    start|up)
        cmd_start
        ;;
    stop|down)
        cmd_stop
        ;;
    restart)
        cmd_restart "$@"
        ;;
    rebuild|build)
        cmd_rebuild "$@"
        ;;
    logs|log)
        cmd_logs "$@"
        ;;
    status|ps)
        cmd_status
        ;;
    backup)
        cmd_backup "$@"
        ;;
    restore)
        cmd_restore "$@"
        ;;
    export-keys)
        cmd_export_keys
        ;;
    shell|exec|sh)
        cmd_shell "$@"
        ;;
    clean)
        cmd_clean "$@"
        ;;
    reset)
        cmd_reset
        ;;
    update)
        cmd_update
        ;;
    maintenance)
        SUBCOMMAND="${1:-status}"
        case "$SUBCOMMAND" in
            on)
                cmd_maintenance_on
                ;;
            off)
                cmd_maintenance_off
                ;;
            status)
                cmd_maintenance_status
                ;;
            *)
                print_error "Unknown maintenance subcommand: $SUBCOMMAND"
                echo "Usage: ./install.sh maintenance <on|off|status>"
                exit 1
                ;;
        esac
        ;;
    fix-env)
        cmd_fix_env
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        echo ""
        cmd_help
        exit 1
        ;;
esac
