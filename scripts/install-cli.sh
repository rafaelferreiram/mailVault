#!/bin/bash
# Install mailvault-deploy as a global CLI pointing at this repo.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TARGET="/usr/local/bin/mailvault-deploy"

echo "Installing mailvault-deploy CLI..."

if [ ! -w /usr/local/bin ] 2>/dev/null; then
  echo "Need write access to /usr/local/bin — retrying with sudo..."
  sudo tee "$TARGET" >/dev/null <<EOF
#!/bin/bash
cd "$PROJECT_DIR" && bash scripts/deploy.sh "\$@"
EOF
  sudo chmod +x "$TARGET"
else
  cat > "$TARGET" <<EOF
#!/bin/bash
cd "$PROJECT_DIR" && bash scripts/deploy.sh "\$@"
EOF
  chmod +x "$TARGET"
fi

echo "Done. Run from anywhere:"
echo "  mailvault-deploy"
echo "  mailvault-deploy --minor"
echo "  mailvault-deploy --no-version-bump"
