#!/bin/sh
# PROJECT ATLAS - Cache busting.
#
# GitHub Pages caches every file for about ten minutes. Without a version
# marker, a browser can get the new index.html together with an old core.js
# (or the other way round), and the page breaks.
#
# This script stamps one new version (date and time, e.g. ?v=202609181530)
# on every local CSS/JS reference that already carries a ?v= marker.
# Run it once before every commit that changes CSS or JS:
#
#   sh tools/bump-version.sh
#
# Files it touches are listed in FILES below. A new page or a new script
# reference needs a ?v= marker once by hand; after that the script keeps it
# up to date.

set -e
cd "$(dirname "$0")/.."

FILES="index.html news.html character-sheet.html src/news/main.js"
NEW=$(date +%Y%m%d%H%M)

for f in $FILES; do
  perl -pi -e "s/\?v=[0-9]+/?v=$NEW/g" "$f"
done

echo "Version set to $NEW in: $FILES"
