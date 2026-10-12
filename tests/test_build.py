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


if __name__ == "__main__":
    unittest.main()
