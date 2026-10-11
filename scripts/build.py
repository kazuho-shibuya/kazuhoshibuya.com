"""Build public/index.html from src/template.html and the LinkedIn text in life-tracker."""

import html
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "src/template.html"
OUTPUT = ROOT / "public/index.html"
SOURCE = ROOT.parent / "life-tracker/projects/career/artefacts/linkedin.md"
LONDON_COMPANIES = {"Ophelos"}


def esc(text):
    return html.escape(text, quote=False)


def section(md, heading):
    match = re.search(
        rf"^## {re.escape(heading)}\n(.*?)(?=^## |\Z)", md, flags=re.MULTILINE | re.DOTALL
    )
    if not match:
        sys.exit(f"linkedin.md has no '## {heading}' section")
    return match.group(1)


def first_block(text):
    match = re.search(r"```\n(.*?)\n```", text, flags=re.DOTALL)
    if not match:
        sys.exit("expected a fenced block")
    return match.group(1)


def paragraphs(block):
    return [p.strip() for p in block.split("\n\n") if p.strip()]


if not SOURCE.exists():
    if os.environ.get("CI"):
        print(f"skipped: {SOURCE.name} is private and not available in CI; checking the committed page")
        sys.exit(0)
    sys.exit(f"missing {SOURCE}")

md = SOURCE.read_text()

headline = first_block(section(md, "1. Headline")).strip()
parts = [p.strip() for p in headline.split("|")]
role, skills, focus, years, city = parts

about = paragraphs(first_block(section(md, "2. About")))
stack_lines = about[-1].splitlines()
about = about[:-1]

roles = []
for match in re.finditer(
    r"^### ([^\n]+?), ([^\n]+) \(([^\n]+)\)\n(.*?)(?=^### |\Z)",
    section(md, "5. Experience"),
    flags=re.MULTILINE | re.DOTALL,
):
    title, company, dates, body = match.groups()
    block = first_block(body)
    lines = block.splitlines()
    summary = lines[0].strip()
    bullets = [line[1:].strip() for line in lines if line.startswith("•")]
    roles.append(
        {
            "title": title,
            "company": company,
            "dates": dates,
            "summary": summary,
            "bullets": bullets,
        }
    )

all_bullets = [b for r in roles for b in r["bullets"]]


def focus_html():
    items = [esc(f.strip()) for f in focus.split("·")]
    spans = [f"<span>{item}<em>·</em></span>" for item in items[:-1]] + [
        f"<span>{items[-1]}</span>"
    ]
    return "".join(spans)


def about_html():
    out = [f'      <p class="lead">{esc(about[0])}</p>']
    out += [f"      <p>{esc(p)}</p>" for p in about[1:]]
    return "\n".join(out)


def experience_html():
    out = ['<ol class="roles">']
    current_city = None
    for r in roles:
        city_code = "ldn" if r["company"] in LONDON_COMPANIES else "tyo"
        if city_code != current_city:
            name = "London" if city_code == "ldn" else "Tokyo"
            if current_city is None:
                out[-1] += f'<li class="zone {city_code}">{name}</li>'
            else:
                out.append(f'      <li class="zone {city_code}">{name}</li>')
            current_city = city_code
        items = "\n".join(f"              <li>{esc(b)}</li>" for b in r["bullets"])
        out.append(
            f'      <li class="role {city_code}">\n'
            f'        <p class="when">{esc(r["dates"])}</p>\n'
            f"        <div>\n"
            f"          <h3>{esc(r['title'])} <span>{esc(r['company'])}</span></h3>\n"
            f'          <p class="summary">{esc(r["summary"])}</p>\n'
            f"          <details>\n"
            f"            <summary>Highlights</summary>\n"
            f"            <ul>\n{items}\n            </ul>\n"
            f"          </details>\n"
            f"        </div>\n"
            f"      </li>"
        )
    out.append("    </ol>")
    return "\n".join(out)


def stack_html():
    rows = []
    for line in stack_lines:
        label, _, value = line.partition(": ")
        rows.append(f"      <div><dt>{esc(label)}</dt><dd>{esc(value)}</dd></div>")
    return "\n".join(rows)


def bullet(prefix):
    found = [b for b in all_bullets if b.startswith(prefix)]
    if len(found) != 1:
        sys.exit(
            f"selected-work prefix {prefix!r} matched {len(found)} bullets in linkedin.md"
        )
    return esc(found[0])


page = TEMPLATE.read_text()
page = page.replace("{{headline}}", esc(headline))
page = page.replace("{{role}}", esc(role)).replace("{{city}}", esc(city))
page = page.replace("{{focus}}", focus_html())
page = page.replace("{{skills}}", esc(skills)).replace("{{years}}", esc(years))
page = page.replace("{{about}}", about_html())
page = page.replace("{{experience}}", experience_html())
page = page.replace("{{stack}}", stack_html())
page = re.sub(r"\{\{bullet: (.+?)\}\}", lambda m: bullet(m.group(1)), page)

leftover = re.findall(r"\{\{.*?\}\}", page)
if leftover:
    sys.exit(f"unfilled placeholders: {leftover}")
OUTPUT.write_text(page)
print(
    f"built {OUTPUT.relative_to(ROOT)} from linkedin.md: {len(roles)} roles, {len(about)} about paragraphs"
)
