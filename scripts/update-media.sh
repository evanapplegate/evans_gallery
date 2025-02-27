#!/bin/bash

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
    video="images/$(basename "${thumb%.*}").mp4"
    video2="images/$(basename "${thumb%.*}").mov"
    video3="images/$(basename "${thumb%.*}").MOV"
    if [ ! -f "$video" ] && [ ! -f "$video2" ] && [ ! -f "$video3" ]; then
      echo "Removing orphaned thumbnail: $thumb"
      rm "$thumb"
    fi
  fi
done

# Update fallback.json
echo '{"files":[' > fallback.json
(
  cd images && \
  find . -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.mp4" -o -name "*.mov" -o -name "*.MOV" \) -exec basename {} \; | \
  sed 's/.*/"&"/' | paste -sd "," -
) >> fallback.json
echo ']}' >> fallback.json

# Stage all changes including deletions
git add -A images/ thumbnails/ fallback.json

# Commit and push if there are changes
if ! git diff --cached --quiet; then
  git commit -m "chore: Update media files and thumbnails"
  git push
fi
