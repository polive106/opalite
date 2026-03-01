#!/usr/bin/env bash
set -euo pipefail

REPO="your-org/opalite"
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

info()  { echo -e "${BOLD}${GREEN}==>${RESET} $1"; }
warn()  { echo -e "${BOLD}${YELLOW}warn:${RESET} $1"; }
error() { echo -e "${BOLD}${RED}error:${RESET} $1" >&2; }

# --- Check OS ---
OS="$(uname -s)"
case "$OS" in
  Linux|Darwin) ;;
  *)
    error "Unsupported OS: $OS. opalite supports macOS and Linux."
    exit 1
    ;;
esac

# --- Check / install Bun ---
if ! command -v bun &>/dev/null; then
  warn "Bun is not installed."
  echo ""
  read -rp "Install Bun now? [Y/n] " answer
  case "${answer:-Y}" in
    [Yy]*)
      info "Installing Bun..."
      curl -fsSL https://bun.sh/install | bash
      # Source the new PATH so bun is available in this session
      export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
      export PATH="$BUN_INSTALL/bin:$PATH"
      if ! command -v bun &>/dev/null; then
        error "Bun installation failed. Please install manually: https://bun.sh"
        exit 1
      fi
      info "Bun installed successfully ($(bun --version))"
      ;;
    *)
      error "Bun is required. Install it from https://bun.sh and try again."
      exit 1
      ;;
  esac
fi

# --- Install opalite globally ---
info "Installing opalite..."
bun install -g opalite

# --- Verify installation ---
BUN_GLOBAL_BIN="$(bun pm bin -g 2>/dev/null || echo "$HOME/.bun/bin")"

if ! command -v opalite &>/dev/null; then
  # Global bin is not in PATH — detect shell and add it
  warn "Bun's global bin directory is not in your PATH."
  SHELL_NAME="$(basename "$SHELL")"
  case "$SHELL_NAME" in
    bash)
      RC_FILE="$HOME/.bashrc"
      ;;
    zsh)
      RC_FILE="$HOME/.zshrc"
      ;;
    fish)
      RC_FILE="$HOME/.config/fish/config.fish"
      ;;
    *)
      warn "Unknown shell: $SHELL_NAME"
      echo "  Add this to your shell profile:"
      echo "    export PATH=\"$BUN_GLOBAL_BIN:\$PATH\""
      echo ""
      info "opalite installed. Restart your shell, then run: opalite --version"
      exit 0
      ;;
  esac

  if [ "$SHELL_NAME" = "fish" ]; then
    EXPORT_LINE="set -gx PATH $BUN_GLOBAL_BIN \$PATH"
  else
    EXPORT_LINE="export PATH=\"$BUN_GLOBAL_BIN:\$PATH\""
  fi

  # Append only if not already present
  if ! grep -qF "$BUN_GLOBAL_BIN" "$RC_FILE" 2>/dev/null; then
    echo "" >> "$RC_FILE"
    echo "# Added by opalite installer" >> "$RC_FILE"
    echo "$EXPORT_LINE" >> "$RC_FILE"
    info "Added $BUN_GLOBAL_BIN to PATH in $RC_FILE"
  fi

  # Source for the current session
  export PATH="$BUN_GLOBAL_BIN:$PATH"
fi

# --- Done ---
VERSION="$(opalite --version 2>/dev/null || echo 'unknown')"
echo ""
info "opalite installed successfully! ($VERSION)"
echo ""
echo "  Get started:"
echo "    opalite login     Log in to Bitbucket"
echo "    opalite init      Set up a repository"
echo "    opalite           Open the review dashboard"
echo ""
