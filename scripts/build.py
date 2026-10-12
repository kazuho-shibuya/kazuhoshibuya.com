"""Build public/index.html from src/template.html and the LinkedIn text in life-tracker."""

import base64
import hashlib
import html
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
TEMPLATE = SRC / "template.html"
OUTPUT = ROOT / "public/index.html"
HEADERS = ROOT / "public/_headers"
SOURCE = ROOT.parent / "life-tracker/projects/career/artefacts/linkedin.md"
LONDON_COMPANIES = {"Ophelos"}

ROLE_HEADING = re.compile(
    r"^### ([^\n]+?), ([^\n]+) \(([^\n]+)\)\n(.*?)(?=^### |\Z)",
    re.MULTILINE | re.DOTALL,
)


class BuildError(Exception):
    """The source text or the template is not in the shape the build expects."""


def esc(text):
    return html.escape(text, quote=False)


def section(md, heading):
    match = re.search(
        rf"^## {re.escape(heading)}\n(.*?)(?=^## |\Z)",
        md,
        flags=re.MULTILINE | re.DOTALL,
    )
    if not match:
        raise BuildError(f"linkedin.md has no '## {heading}' section")
    return match.group(1)


def first_block(text, where):
    match = re.search(r"```\n(.*?)\n```", text, flags=re.DOTALL)
    if not match:
        raise BuildError(f"{where} has no fenced block")
    if not match.group(1).strip():
        raise BuildError(f"{where} has an empty fenced block")
    return match.group(1)


def paragraphs(block):
    return [p.strip() for p in block.split("\n\n") if p.strip()]


def parse(md, london_companies=LONDON_COMPANIES):
    headline = first_block(section(md, "1. Headline"), "the headline").strip()
    parts = [p.strip() for p in headline.split("|")]
    if len(parts) != 5:
        raise BuildError(f"the headline needs 5 parts separated by '|', found {len(parts)}")
    role, skills, focus, years, city = parts

    about = paragraphs(first_block(section(md, "2. About"), "About"))
    stack_lines = about[-1].splitlines()
    unlabelled = [line for line in stack_lines if ": " not in line]
    if unlabelled:
        raise BuildError(f"stack lines need 'Label: value': {unlabelled}")
    stack = [tuple(line.split(": ", 1)) for line in stack_lines]

    experience = section(md, "5. Experience")
    found = ROLE_HEADING.findall(experience)
    headings = re.findall(r"^### ", experience, flags=re.MULTILINE)
    if not found or len(found) != len(headings):
        raise BuildError(f"role headings must read '### Title, Company (dates)'; matched {len(found)} of {len(headings)}")

    roles = []
    for title, company, dates, body in found:
        lines = first_block(body, f"role '{title}, {company}'").splitlines()
        bullets = [line[1:].strip() for line in lines if line.startswith("•")]
        if not bullets:
            raise BuildError(f"role '{title}, {company}' has no '•' bullets")
        roles.append(
            {
                "title": title,
                "company": company,
                "dates": dates,
                "city": "ldn" if company in london_companies else "tyo",
                "summary": lines[0].strip(),
                "bullets": bullets,
            }
        )

    return {
        "headline": headline,
        "role": role,
        "skills": skills,
        "focus": [f.strip() for f in focus.split("·")],
        "years": years,
        "city": city,
        "about": about[:-1],
        "stack": stack,
        "roles": roles,
    }


def focus_html(focus):
    items = [esc(f) for f in focus]
    spans = [f"<span>{item}<em>·</em></span>" for item in items[:-1]] + [f"<span>{items[-1]}</span>"]
    return "".join(spans)


def about_html(about):
    out = [f'      <p class="lead">{esc(about[0])}</p>']
    out += [f"      <p>{esc(p)}</p>" for p in about[1:]]
    return "\n".join(out)


def experience_html(roles):
    out = ['<ol class="roles">']
    current_city = None
    for r in roles:
        if r["city"] != current_city:
            zone = f'<li class="zone {r["city"]}">{"London" if r["city"] == "ldn" else "Tokyo"}</li>'
            if current_city is None:
                out[-1] += zone
            else:
                out.append(f"      {zone}")
            current_city = r["city"]
        items = "\n".join(f"              <li>{esc(b)}</li>" for b in r["bullets"])
        out.append(
            f'      <li class="role {r["city"]}">\n'
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


def stack_html(stack):
    return "\n".join(f"      <div><dt>{esc(label)}</dt><dd>{esc(value)}</dd></div>" for label, value in stack)


def bullet(roles, prefix):
    found = [b for r in roles for b in r["bullets"] if b.startswith(prefix)]
    if len(found) != 1:
        raise BuildError(f"selected-work prefix {prefix!r} matched {len(found)} bullets in linkedin.md")
    return esc(found[0])


def include_files(template, folder=SRC):
    def contents(match):
        path = folder / match.group(1)
        if not path.exists():
            raise BuildError(f"the template includes {match.group(1)}, which is not in {folder.name}/")
        return path.read_text().rstrip("\n")

    return re.sub(r"\{\{include: (.+?)\}\}", contents, template)


def render(template, data):
    page = template.replace("{{headline}}", esc(data["headline"]))
    page = page.replace("{{role}}", esc(data["role"]))
    page = page.replace("{{city}}", esc(data["city"]))
    page = page.replace("{{focus}}", focus_html(data["focus"]))
    page = page.replace("{{skills}}", esc(data["skills"]))
    page = page.replace("{{years}}", esc(data["years"]))
    page = page.replace("{{about}}", about_html(data["about"]))
    page = page.replace("{{experience}}", experience_html(data["roles"]))
    page = page.replace("{{stack}}", stack_html(data["stack"]))
    page = re.sub(r"\{\{bullet: (.+?)\}\}", lambda m: bullet(data["roles"], m.group(1)), page)
    leftover = re.findall(r"\{\{.*?\}\}", page)
    if leftover:
        raise BuildError(f"unfilled placeholders: {leftover}")
    return page


def csp_hash(code):
    return "'sha256-" + base64.b64encode(hashlib.sha256(code.encode()).digest()).decode() + "'"


def headers_file(page):
    """Cloudflare's _headers file: a strict policy that allows only this page's own inline code."""
    with_attributes = re.findall(r"<(?:script|style)\s(?![^>]*\bsrc=)[^>]*>", page)
    if with_attributes:
        raise BuildError(f"inline script and style tags must have no attributes, or the policy gets no hash for them: {with_attributes}")
    scripts = [csp_hash(code) for code in re.findall(r"<script>(.*?)</script>", page, flags=re.DOTALL)]
    styles = [csp_hash(code) for code in re.findall(r"<style>(.*?)</style>", page, flags=re.DOTALL)]
    policy = "; ".join(
        [
            "default-src 'none'",
            "script-src " + " ".join(scripts + ["https://static.cloudflareinsights.com"]),
            "style-src " + " ".join(styles),
            "font-src 'self'",
            "img-src 'self' data:",
            "connect-src 'self' https://cloudflareinsights.com",
            "base-uri 'none'",
            "form-action 'none'",
            "frame-ancestors 'none'",
        ]
    )
    rules = [
        ("Content-Security-Policy", policy),
        ("Strict-Transport-Security", "max-age=31536000; includeSubDomains"),
        ("X-Content-Type-Options", "nosniff"),
        ("Referrer-Policy", "strict-origin-when-cross-origin"),
        ("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"),
        ("Cross-Origin-Opener-Policy", "same-origin"),
    ]
    return "/*\n" + "".join(f"  {name}: {value}\n" for name, value in rules)


def main():
    if not SOURCE.exists():
        if os.environ.get("CI"):
            print(f"skipped: {SOURCE.name} is private and not available in CI; checking the committed page")
            return 0
        print(f"missing {SOURCE}", file=sys.stderr)
        return 1
    try:
        data = parse(SOURCE.read_text())
        page = render(include_files(TEMPLATE.read_text()), data)
        OUTPUT.write_text(page)
        HEADERS.write_text(headers_file(page))
    except BuildError as error:
        print(f"build failed: {error}", file=sys.stderr)
        return 1
    print(f"built {OUTPUT.relative_to(ROOT)} from linkedin.md: {len(data['roles'])} roles, {len(data['about'])} about paragraphs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
