for (const link of document.querySelectorAll("a[data-copy]")) {
  link.addEventListener("click", async (event) => {
    if (!navigator.clipboard) return;
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(link.dataset.copy);
      const status = link.nextElementSibling;
      status.textContent = "";
      // Emptying first makes screen readers announce a repeat tap.
      requestAnimationFrame(() => (status.textContent = `Copied ${link.dataset.copy}`));
    } catch {
      location.href = link.href;
    }
  });
}
const root = document.documentElement;
const toggle = document.querySelector("button.theme");
const systemTheme = () => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
const isDark = () => (root.dataset.theme || systemTheme()) === "dark";
const label = () => toggle.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode");
toggle.hidden = false;
label();
toggle.addEventListener("click", () => {
  root.dataset.theme = isDark() ? "light" : "dark";
  try {
    localStorage.setItem("theme", root.dataset.theme);
  } catch (e) {}
  label();
});
