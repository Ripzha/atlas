#!/bin/sh
# PROJECT ATLAS - Cache busting.
#
# GitHub Pages caches every file for about ten minutes. Without a version
# marker, a browser can get a new file together with an old one it imports,
# and the page breaks.
#
# This script stamps one new version (date and time, e.g. ?v=202609181530)
# on every ?v= marker: script and stylesheet references in the pages,
# modulepreload links, and every import statement in the JavaScript modules.
# All markers get the SAME number — a module imported with two different
# numbers would be loaded twice.
#
# Run it once before every commit that changes CSS or JS:
#
#   sh tools/bump-version.sh
#
# A new reference or import needs its ?v= marker once by hand (any number);
# after that the script keeps it up to date.

set -e
cd "$(dirname "$0")/.."

FILES="index.html news.html metaverse.html simstagram.html character-sheet.html $(find src -name '*.js' | sort)"
NEW=$(date +%Y%m%d%H%M)

for f in $FILES; do
  perl -pi -e "s/\?v=[0-9]+/?v=$NEW/g" "$f"
done

echo "Version set to $NEW in $(echo $FILES | wc -w | tr -d ' ') files"
