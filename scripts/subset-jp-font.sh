#!/bin/bash
# Rebuild public/fonts/noto-serif-jp.woff2 with only the Japanese characters the page uses.
# Run after changing any text inside lang="ja"; the test suite fails if a character is missing.
set -e
cd "$(dirname "$0")/.."
chars=$(python3 -c "import re; t=open('src/template.html').read(); print(''.join(sorted(set(''.join(re.findall(r'lang=\"ja\">([^<]*)<', t)).replace(' ','')))))")
ua="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/129 Safari/537.36"
css=$(curl -sf -A "$ua" "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@500&text=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$chars")")
url=$(echo "$css" | grep -o 'https://[^)]*' | head -1)
curl -sf "$url" -o public/fonts/noto-serif-jp.woff2
echo "noto-serif-jp.woff2 rebuilt for: $chars ($(wc -c < public/fonts/noto-serif-jp.woff2 | tr -d ' ') bytes)"
