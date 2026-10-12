"""Unit tests for scripts/build.py, run with: python3 -m unittest discover tests"""

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import build

FIXTURE = (ROOT / "tests/fixtures/linkedin.md").read_text()


class ParseTest(unittest.TestCase):
    def setUp(self):
        self.data = build.parse(FIXTURE, london_companies={"Acme"})

    def test_headline_splits_into_its_five_parts(self):
        self.assertEqual(self.data["role"], "Engineer at Acme")
        self.assertEqual(self.data["skills"], "Go · Rust")
        self.assertEqual(self.data["focus"], ["Queues", "Caches", "Search"])
        self.assertEqual(self.data["years"], "5+ yrs across retail & media")
        self.assertEqual(self.data["city"], "Leeds")

    def test_about_keeps_the_paragraphs_and_moves_the_last_block_to_the_stack(self):
        self.assertEqual(len(self.data["about"]), 2)
        self.assertEqual(self.data["stack"], [("Languages", "Go, Rust"), ("Data", "Redis, Kafka")])

    def test_roles_keep_a_comma_in_the_company_name(self):
        companies = [r["company"] for r in self.data["roles"]]
        self.assertEqual(companies, ["Acme", "Acme", "Widgets, Inc."])

    def test_each_role_has_its_summary_and_bullets(self):
        first = self.data["roles"][0]
        self.assertEqual(first["summary"], "Builds the search platform.")
        self.assertEqual(len(first["bullets"]), 2)

    def test_cities_follow_the_company(self):
        self.assertEqual([r["city"] for r in self.data["roles"]], ["ldn", "ldn", "tyo"])

    def test_a_missing_section_names_the_section(self):
        broken = FIXTURE.replace("## 2. About", "## 2. Bio")
        with self.assertRaisesRegex(build.BuildError, "2. About"):
            build.parse(broken, london_companies={"Acme"})

    def test_a_headline_without_five_parts_is_an_error(self):
        broken = FIXTURE.replace("Engineer at Acme | ", "")
        with self.assertRaisesRegex(build.BuildError, "5 parts"):
            build.parse(broken, london_companies={"Acme"})

    def test_a_stack_line_without_a_label_is_an_error(self):
        broken = FIXTURE.replace("Languages: Go, Rust", "Go, Rust")
        with self.assertRaisesRegex(build.BuildError, "Label: value"):
            build.parse(broken, london_companies={"Acme"})

    def test_a_role_heading_in_another_shape_is_an_error(self):
        broken = FIXTURE.replace("### Engineer, Acme (Jan 2023 – Jan 2025)", "### Engineer at Acme, 2023 to 2025")
        with self.assertRaisesRegex(build.BuildError, "matched 2 of 3"):
            build.parse(broken, london_companies={"Acme"})

    def test_a_role_without_bullets_is_an_error(self):
        broken = FIXTURE.replace("\n\n• Wrote the deployment scripts.", "")
        with self.assertRaisesRegex(build.BuildError, "'Developer, Widgets, Inc.' has no"):
            build.parse(broken, london_companies={"Acme"})

    def test_a_role_without_a_fenced_block_names_the_role(self):
        broken = FIXTURE.replace("```\nBuilt internal tools.\n\n• Wrote the deployment scripts.\n```", "Built internal tools.")
        with self.assertRaisesRegex(build.BuildError, "'Developer, Widgets, Inc.' has no fenced block"):
            build.parse(broken, london_companies={"Acme"})

    def test_an_empty_fenced_block_is_an_error(self):
        broken = FIXTURE.replace("```\nBuilt internal tools.\n\n• Wrote the deployment scripts.\n```", "```\n\n```")
        with self.assertRaisesRegex(build.BuildError, "empty fenced block"):
            build.parse(broken, london_companies={"Acme"})


class RenderTest(unittest.TestCase):
    def setUp(self):
        self.data = build.parse(FIXTURE, london_companies={"Acme"})

    def test_text_is_escaped(self):
        page = build.render("{{about}}", self.data)
        self.assertIn("&lt;work&gt; &amp; more", page)

    def test_city_labels_appear_once_each_where_the_city_changes(self):
        page = build.render("{{experience}}", self.data)
        self.assertEqual(page.count('class="zone ldn"'), 1)
        self.assertEqual(page.count('class="zone tyo"'), 1)
        self.assertLess(page.index('class="zone ldn"'), page.index('class="zone tyo"'))

    def test_a_selected_bullet_is_found_by_its_opening_words(self):
        page = build.render("{{bullet: Cut search latency}}", self.data)
        self.assertEqual(page, "Cut search latency in half by caching hot queries.")

    def test_a_bullet_prefix_that_matches_nothing_is_an_error(self):
        with self.assertRaisesRegex(build.BuildError, "matched 0"):
            build.render("{{bullet: Invented claim}}", self.data)

    def test_an_unfilled_placeholder_is_an_error(self):
        with self.assertRaisesRegex(build.BuildError, "unfilled"):
            build.render("{{headline}} {{typo}}", self.data)


class HeadersTest(unittest.TestCase):
    def test_every_inline_script_and_style_is_allowed_by_its_hash_and_nothing_else_inline(self):
        page = "<style>a{}</style><script>one()</script><script>two()</script><script src='x.js'></script>"
        headers = build.headers_file(page)
        csp = next(line for line in headers.splitlines() if "Content-Security-Policy" in line)
        for code in ["a{}", "one()", "two()"]:
            self.assertIn(build.csp_hash(code), csp)
        self.assertEqual(csp.count("'sha256-"), 3)
        self.assertNotIn("unsafe-inline", csp)

    def test_an_inline_script_or_style_with_attributes_is_an_error(self):
        for page in ['<script type="module">x()</script>', '<style media="print">a{}</style>']:
            with self.subTest(page=page), self.assertRaisesRegex(build.BuildError, "attributes"):
                build.headers_file(page)


class IncludeTest(unittest.TestCase):
    def test_an_include_is_replaced_by_the_file(self):
        page = build.include_files("<style>\n{{include: styles.css}}\n</style>")
        self.assertIn((ROOT / "src/styles.css").read_text().rstrip("\n"), page)
        self.assertNotIn("{{include", page)

    def test_an_include_of_a_missing_file_is_an_error(self):
        with self.assertRaisesRegex(build.BuildError, "missing.css"):
            build.include_files("{{include: missing.css}}")


class CommittedPageTest(unittest.TestCase):
    def test_every_fixed_line_of_every_source_file_reaches_the_committed_page_in_order(self):
        """CI cannot rebuild without the private source, so this catches a source edit that was never built."""
        page = (ROOT / "public/index.html").read_text()
        for source in ["template.html", "styles.css", "theme.js", "page.js"]:
            position = 0
            for line in (ROOT / "src" / source).read_text().splitlines():
                if not line.strip() or "{{" in line:
                    continue
                found = page.find(line, position)
                self.assertNotEqual(found, -1, f"run npm run build; public/index.html lacks this line of {source}: {line.strip()[:80]}")
                position = found + len(line)


if __name__ == "__main__":
    unittest.main()
