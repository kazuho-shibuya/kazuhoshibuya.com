for (const link of document.querySelectorAll("a[data-copy]")) {
  link.addEventListener("click", async (event) => {
    if (!navigator.clipboard) return;
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(link.dataset.copy);
      link.nextElementSibling.textContent = `Copied ${link.dataset.copy}`;
    } catch {
      location.href = link.href;
    }
  });
}
const root = document.documentElement;
const toggle = document.querySelector("button.theme");
const isDark = () => (root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
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
