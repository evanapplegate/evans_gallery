#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the parent directory (project root)
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project root
cd "$ROOT_DIR"

# Create thumbnails directory if it doesn't exist
mkdir -p thumbnails

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

# Generate thumbnails for videos
for video in images/*.mp4; do
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
    if [ ! -f "images/$(basename "$base").mp4" ]; then
      echo "Removing orphaned thumbnail: $thumb"
      rm "$thumb"
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

# Stage all changes including deletions
git add -A images/ thumbnails/ fallback.json 2>/dev/null || true

# Commit and push if there are changes
if ! git diff --cached --quiet; then
  git commit -m "chore: Update media files and thumbnails"
  git push
fi
