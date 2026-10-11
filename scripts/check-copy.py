"""Every long sentence on the page must appear verbatim in the LinkedIn text file."""

import html
import os
import re
import sys

PAGE = "public/index.html"
SOURCE = "../life-tracker/projects/career/artefacts/linkedin.md"
MIN_LEN = 40

if not os.path.exists(SOURCE):
    if os.environ.get("CI"):
        print(f"skipped: {SOURCE} is private and not available in CI")
        sys.exit(0)
    sys.exit(f"missing {SOURCE}")

page = open(PAGE).read()
page = re.sub(r"<style>.*?</style>", "", page, flags=re.DOTALL)
# The build notes and the headings are the page's own words, not LinkedIn copy.
page = re.sub(
    r'<section class="block colophon".*?</section>', "", page, flags=re.DOTALL
)
page = re.sub(r"<h[1-3][^>]*>.*?</h[1-3]>", "", page, flags=re.DOTALL)
source = open(SOURCE).read()

blocks = re.findall(r"<(?:p|li|dd)[^>]*>(.*?)</(?:p|li|dd)>", page, flags=re.DOTALL)
texts = [
    re.sub(r"\s+", " ", html.unescape(re.sub("<[^>]+>", " ", b))).strip()
    for b in blocks
]
sentences = [s for t in texts for s in re.split(r"(?<=\.)\s", t) if len(s) >= MIN_LEN]
missing = [s for s in sentences if s not in source]

print(f"{len(sentences)} sentences checked, {len(missing)} not in {SOURCE}")
for s in missing:
    print(" -", s[:100])
sys.exit(1 if missing else 0)
