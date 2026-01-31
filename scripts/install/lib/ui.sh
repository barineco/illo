# ui.sh - UI helper functions (print, spinner, progress bar, box drawing)
# This file is sourced by install.sh - do not execute directly

################################################################################
# Print Functions
################################################################################

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_prod() { echo -e "${MAGENTA}[PROD]${NC} $1"; }

################################################################################
# Step Progress Display
################################################################################

CURRENT_STEP=0
TOTAL_STEPS=0

start_steps() {
    TOTAL_STEPS=$1
    CURRENT_STEP=0
    echo ""
}

step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    echo -e "${DIM}[$CURRENT_STEP/$TOTAL_STEPS]${NC} $1"
}

step_done() {
    echo -e "  ${CHECK} $1"
}

step_warn() {
    echo -e "  ${WARN} $1"
}

step_fail() {
    echo -e "  ${CROSS} $1"
}

################################################################################
# Spinner Animation
################################################################################

SPINNER_PID=""

start_spinner() {
    local message="$1"
    local spinner_chars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0

    tput civis 2>/dev/null || true

    while true; do
        local char="${spinner_chars:$i:1}"
        printf "\r  ${CYAN}%s${NC} %s" "$char" "$message"
        i=$(( (i + 1) % ${#spinner_chars} ))
        sleep 0.1
    done &
    SPINNER_PID=$!
}

stop_spinner() {
    local success="${1:-true}"
    local message="${2:-}"
    if [ -n "$SPINNER_PID" ]; then
        kill "$SPINNER_PID" 2>/dev/null || true
        wait "$SPINNER_PID" 2>/dev/null || true
        SPINNER_PID=""
    fi
    tput cnorm 2>/dev/null || true
    printf "\r\033[K"
    if [ -n "$message" ]; then
        if [ "$success" = "true" ]; then
            echo -e "  ${CHECK} $message"
        else
            echo -e "  ${CROSS} $message"
        fi
    fi
}

################################################################################
# Progress Bar
################################################################################

progress_bar() {
    local current=$1
    local total=$2
    local width=40
    local percent=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))

    printf "\r  ["
    printf "%${filled}s" | tr ' ' '█'
    printf "%${empty}s" | tr ' ' '░'
    printf "] %3d%%" "$percent"
}

################################################################################
# Box Drawing
################################################################################

print_box() {
    local title="$1"
    local width=68

    echo ""
    echo -e "${BOLD}╔$(printf '═%.0s' $(seq 1 $width))╗${NC}"
    echo -e "${BOLD}║${NC}${RED}$(printf '%*s' $(( (width + ${#title}) / 2 )) "$title")$(printf '%*s' $(( (width - ${#title}) / 2 )) "")${NC}${BOLD}║${NC}"
    echo -e "${BOLD}╠$(printf '═%.0s' $(seq 1 $width))╣${NC}"
}

print_box_line() {
    local text="$1"
    local width=68
    local padding=$((width - ${#text} - 1))
    echo -e "${BOLD}║${NC} ${text}$(printf '%*s' $padding "")${BOLD}║${NC}"
}

print_box_end() {
    local width=68
    echo -e "${BOLD}╚$(printf '═%.0s' $(seq 1 $width))╝${NC}"
    echo ""
}
