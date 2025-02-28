#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the parent directory (project root)
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project root
cd "$ROOT_DIR"

# Create thumbnails directory if it doesn't exist
mkdir -p thumbnails

# Generate thumbnails for videos
for video in images/*.{mp4,mov,MOV}; do
  if [ -f "$video" ]; then
    thumb="thumbnails/$(basename "${video%.*}").jpg"
    # Only generate if thumbnail doesn't exist or video is newer
    if [ ! -f "$thumb" ] || [ "$video" -nt "$thumb" ]; then
      echo "Generating thumbnail for $video"
      ffmpeg -i "$video" -vframes 1 -f image2 "$thumb"
    fi
  fi
done

# Clean up thumbnails for deleted videos
for thumb in thumbnails/*.jpg; do
  if [ -f "$thumb" ]; then
    base="${thumb%.*}"
    if [ ! -f "images/$(basename "$base").mp4" ] && \
       [ ! -f "images/$(basename "$base").mov" ] && \
       [ ! -f "images/$(basename "$base").MOV" ]; then
      echo "Removing orphaned thumbnail: $thumb"
      rm "$thumb"
    fi
  fi
done

# Update fallback.json
echo '{"files":[' > fallback.json
(
  cd images 2>/dev/null && \
  find . -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.mp4" -o -name "*.mov" -o -name "*.MOV" \) -exec basename {} \; | \
  sed 's/.*/"&"/' | paste -sd "," - || echo ""
) >> fallback.json
echo ']}' >> fallback.json

# Stage all changes including deletions
git add -A images/ thumbnails/ fallback.json 2>/dev/null || true

# Commit and push if there are changes
if ! git diff --cached --quiet; then
  git commit -m "chore: Update media files and thumbnails"
  git push
fi
