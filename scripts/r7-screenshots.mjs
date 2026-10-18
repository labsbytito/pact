import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const OUT = "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });
mkdirSync("/workspace/screenshots", { recursive: true });

const now = new Date().toISOString();
const samplePacts = [
  {
    id: "pact-otto",
    characterSeed: "seed-otto",
    title: "Otto",
    intention: "Research competitor pricing",
    createdAt: now,
    updatedAt: now,
    sectionId: "sec-research",
    messages: [
      { id: "m1", role: "user", text: "Research competitor pricing", at: now },
      {
        id: "m2",
        role: "assistant",
        text: "I pulled three pricing pages. Want a comparison table?",
        at: now,
      },
    ],
  },
  {
    id: "pact-mochi",
    characterSeed: "seed-mochi",
    title: "Mochi",
    intention: "Draft outreach email",
    createdAt: now,
    updatedAt: now,
    pinned: true,
    messages: [
      { id: "m3", role: "user", text: "Draft outreach email", at: now },
      {
        id: "m4",
        role: "assistant",
        text: "Here’s a short cold email you can send tonight…",
        at: now,
      },
    ],
  },
  {
    id: "pact-tofu",
    characterSeed: "seed-tofu",
    title: "Tofu",
    intention: "Fix the broken sink",
    createdAt: now,
    updatedAt: now,
    sectionId: "sec-home",
    messages: [
      {
        id: "m5",
        role: "user",
        text: "How do I fix a dripping sink?",
        at: now,
      },
    ],
  },
];

const sections = [
  { id: "sec-research", name: "Research", createdAt: now },
  { id: "sec-home", name: "Handyman", createdAt: now },
];

async function seed(page, theme) {
  await page.addInitScript(
    ({ pacts, sections, theme }) => {
      localStorage.setItem("pacts", JSON.stringify(pacts));
      localStorage.setItem("sections", JSON.stringify(sections));
      localStorage.setItem(
        "settings",
        JSON.stringify({ onboarded: true, theme }),
      );
      localStorage.setItem(
        "companion",
        JSON.stringify({ shape: 0, color: "#8B5CF6" }),
      );
      localStorage.setItem("activePact", JSON.stringify(null));
    },
    { pacts: samplePacts, sections, theme },
  );
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  await page.screenshot({
    path: join("/workspace/screenshots", `${name}.png`),
    fullPage: false,
  });
  console.log("wrote", path);
}

async function openPanel(browser, theme) {
  const page = await browser.newPage({
    viewport: { width: 400, height: 720 },
    colorScheme: theme === "light" ? "light" : "dark",
  });
  await seed(page, theme);
  await page.goto("http://localhost:40317/entrypoints/sidepanel/index.html", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(900);
  await page.waitForSelector(".app-shell", { timeout: 15000 });
  return page;
}

async function openLibrary(page) {
  const mobile = page.locator('button[aria-label="My Pacts"]');
  if (await mobile.isVisible().catch(() => false)) {
    await mobile.click();
  } else {
    await page.locator(".sidebar-nav").first().click({ force: true });
  }
  await page.waitForTimeout(400);
}

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  for (const theme of ["dark", "light"]) {
    {
      const page = await openPanel(browser, theme);
      await page.waitForTimeout(500);
      await shot(page, `r7-greeting-${theme}`);
      await page.close();
    }
    {
      const page = await openPanel(browser, theme);
      await openLibrary(page);
      await shot(page, `r7-list-${theme}`);
      await page.close();
    }
    {
      const page = await openPanel(browser, theme);
      await page.locator('button[aria-label="Settings"]').first().click();
      await page.waitForSelector(".settings-shell", { timeout: 5000 });
      await page.waitForTimeout(300);
      await shot(page, `r7-settings-${theme}`);
      await page.close();
    }
    {
      const page = await openPanel(browser, theme);
      await page.locator("button.hello-edit").click();
      await page.waitForSelector(".companion-stage", { timeout: 5000 });
      await page.waitForTimeout(300);
      await shot(page, `r7-editor-${theme}`);
      await page.close();
    }
    {
      const page = await openPanel(browser, theme);
      await openLibrary(page);
      const row = page.locator(".pact-tile-wrap, .recent-row").first();
      await row.hover();
      const more = row.locator("button.pact-more");
      if (await more.count()) {
        await more.evaluate((el) => {
          el.style.opacity = "1";
        });
        await more.click({ force: true });
      } else {
        await row.click({ button: "right" });
      }
      await page.waitForSelector(".pact-menu", { timeout: 5000 });
      await page.waitForTimeout(250);
      await shot(page, `r7-menu-${theme}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log("done");
