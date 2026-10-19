try {
  var theme = JSON.parse(localStorage.getItem("pact-theme") || '"system"');
  var dark = theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.background = dark ? "#121212" : "#fcfcfc";
} catch (e) {}
