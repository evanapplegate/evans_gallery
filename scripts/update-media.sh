#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the parent directory (project root)
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project root
cd "$ROOT_DIR"

# Convert MOV to MP4 and delete original
for mov in images/*.{mov,MOV}; do
  if [ -f "$mov" ]; then
    mp4="images/$(basename "${mov%.*}").mp4"
    if [ ! -f "$mp4" ] || [ "$mov" -nt "$mp4" ]; then
      echo "Converting $mov to MP4"
      ffmpeg -i "$mov" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k "$mp4"
      if [ $? -eq 0 ]; then
        echo "Removing original MOV file: $mov"
        rm "$mov"
      fi
    fi
  fi
done

# Update fallback.json
echo "Generating fallback.json..." >&2
echo '{"files":[' > fallback.json

# First, add all files starting with underscore
(
  cd images 2>/dev/null && \
  find . -type f -name "_*" \( -iname "*.jpg" -o -iname "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.mp4" \) -exec basename {} \; | \
  LC_ALL=C sort | \
  sed 's/.*/"&",/' > /tmp/underscore_files.txt
)

# Then add all other files
(
  cd images 2>/dev/null && \
  find . -type f ! -name "_*" \( -iname "*.jpg" -o -iname "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.mp4" \) -exec basename {} \; | \
  LC_ALL=C sort | \
  sed 's/.*/"&",/' > /tmp/regular_files.txt
)

# Remove trailing comma from the last file
if [ -s /tmp/regular_files.txt ]; then
  sed -i '' '$ s/,$//' /tmp/regular_files.txt
elif [ -s /tmp/underscore_files.txt ]; then
  sed -i '' '$ s/,$//' /tmp/underscore_files.txt
fi

# Combine them
cat /tmp/underscore_files.txt /tmp/regular_files.txt >> fallback.json

echo ']}' >> fallback.json
echo "Generated fallback.json" >&2

# Build WebP grid thumbs and add their sizes to fallback.json
python3 scripts/build_thumbs.py || exit 1

# Stage all changes including deletions
git add -A images/ thumbs/ fallback.json 2>/dev/null || true

# Commit and push if there are changes
if ! git diff --cached --quiet; then
  git commit -m "chore: Update media files and thumbnails"
  git push
fi
