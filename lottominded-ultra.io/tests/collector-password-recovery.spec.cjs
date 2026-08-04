const { test, expect } = require("@playwright/test");

const API_PATTERN = /https:\/\/sqdasdbvlkgpbbiyeune\.supabase\.co\/functions\/v1\/lottomind-api.*/i;

async function blockMedia(page) {
  await page.route(/\.(?:mp4|webm|mp3|wav)(?:\?.*)?$/i, (route) => route.abort());
}

async function mockAccountApi(page, onRequest = () => {}) {
  await page.route(API_PATTERN, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      "Access-Control-Allow-Origin": request.headers().origin || "http://127.0.0.1:8142",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, x-requested-with",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    onRequest(request, path);
    if (path.endsWith("/account/snapshot")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers,
        body: JSON.stringify({ authenticated: false, verified: true, featureEnabled: true, wallet: { balance: 0 }, memberships: [], collector: {} }),
      });
    }
    if (path.endsWith("/billing/config")) {
      return route.fulfill({ status: 200, contentType: "application/json", headers, body: '{"enabled":false,"plans":[]}' });
    }
    if (path.endsWith("/auth/login")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers,
        body: JSON.stringify({
          session: { access_token: "collector-test-token", refresh_token: "refresh", expires_at: 4102444800 },
          snapshot: { authenticated: true, verified: true, featureEnabled: true, user: { id: "collector" }, wallet: { balance: 0 }, memberships: [], collector: {} },
        }),
      });
    }
    if (path.endsWith("/auth/password-reset")) {
      return route.fulfill({ status: 200, contentType: "application/json", headers, body: '{"requested":true}' });
    }
    if (path.endsWith("/auth/password-update")) {
      return route.fulfill({ status: 200, contentType: "application/json", headers, body: '{"updated":true}' });
    }
    return route.fulfill({ status: 204, headers });
  });
}

async function openCollector(page) {
  await page.goto("/memberships.html?collector=access#lm-access-hero", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-collector-panel]")).toBeVisible();
  await expect(page.locator("[data-membership-commercial-modal]")).toBeHidden();
}

test("Collector Access requests password recovery without sending a password", async ({ page }) => {
  let recoveryPayload = null;
  await blockMedia(page);
  await mockAccountApi(page, (request, path) => {
    if (path.endsWith("/auth/password-reset")) recoveryPayload = request.postDataJSON();
  });
  await openCollector(page);

  const password = page.locator("#collectorPassword");
  const toggle = page.locator('[data-password-toggle][aria-controls="collectorPassword"]');
  await password.fill("not-sent-to-recovery");
  await toggle.click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await page.locator("#collectorEmail").fill("collector@example.com");
  await page.locator("[data-collector-forgot-password]").click();
  await expect(page.locator("[data-collector-message]")).toContainText("If an account matches that email");
  expect(recoveryPayload).toEqual({ email: "collector@example.com" });
});

test("Home places Collector Access beside Unlock Vault and opens the shared sign-in", async ({ page }) => {
  await blockMedia(page);
  await mockAccountApi(page);
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });

  const actions = page.locator(".refined-actions");
  const labels = await actions.locator(":scope > *").evaluateAll((elements) => elements.map((element) => element.textContent.trim()));
  expect(labels.indexOf("Collector Access")).toBe(labels.indexOf("Unlock Vault") + 1);
  await expect(actions.getByRole("link", { name: "Collector Access" })).toHaveAttribute("href", "./memberships.html?collector=access#lm-access-hero");

  await page.goto("/memberships.html?collector=access#lm-access-hero", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-collector-panel]")).toBeVisible();
  await expect(page.locator("#collectorEmail")).toBeFocused();
});

test("Collector Access only persists sign-in when Remember me is selected", async ({ page }) => {
  await blockMedia(page);
  await mockAccountApi(page);
  await openCollector(page);

  await page.locator("#collectorEmail").fill("collector@example.com");
  await page.locator("#collectorPassword").fill("secure-test-password");
  await page.locator('[data-collector-auth-form] button[value="login"]').click();
  await expect(page.locator("[data-collector-message]")).toContainText("Account verified");

  const stored = await page.evaluate(() => ({
    local: localStorage.getItem("lottomind.account.session.v1"),
    session: sessionStorage.getItem("lottomind.account.session.v1"),
  }));
  expect(stored.local).toBeNull();
  expect(stored.session).toContain("collector-test-token");
});

test("Collector recovery link completes a password update with its temporary session", async ({ page }) => {
  let updateAuthorization = "";
  await blockMedia(page);
  await mockAccountApi(page, (request, path) => {
    if (path.endsWith("/auth/password-update")) updateAuthorization = request.headers().authorization || "";
  });

  await page.goto("/memberships.html?account=recovery#access_token=recovery-token&refresh_token=recovery-refresh&expires_at=4102444800&type=recovery", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-collector-recovery-form]")).toBeVisible();
  await page.locator("#collectorNewPassword").fill("new-secure-password");
  await page.locator("#collectorConfirmPassword").fill("new-secure-password");
  await page.locator('[data-collector-recovery-form] button[type="submit"]').click();

  await expect(page.locator("[data-collector-message]")).toContainText("Password updated");
  expect(updateAuthorization).toBe("Bearer recovery-token");
  await expect(page).not.toHaveURL(/account=recovery/);
});

test("Collector Redemption boots with the configured static account service", async ({ page }) => {
  await blockMedia(page);
  await mockAccountApi(page);
  await page.goto("/redeem.html", { waitUntil: "domcontentloaded" });

  expect(await page.evaluate(() => window.LottoMindAccountService?.isConfigured())).toBe(true);
  await expect(page.locator("[data-account-state]")).toContainText("Sign in or create an account");
});

test("password recovery API keeps reset responses generic and validates updates", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "lottomind-api", "index.ts"), "utf8");
  expect(source).toContain('path === "/auth/password-reset"');
  expect(source).toContain("resetPasswordForEmail(email, { redirectTo })");
  expect(source).toContain('path === "/auth/password-update"');
  expect(source).toContain("password.length < 10");
  expect(source).not.toContain("No account exists");
});

test("every static account client loads the production runtime configuration first", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const siteRoot = path.join(__dirname, "..");
  const pages = fs.readdirSync(siteRoot).filter((name) => name.endsWith(".html"));
  const accountPages = pages.filter((name) => {
    const source = fs.readFileSync(path.join(siteRoot, name), "utf8");
    return source.includes("lottomind-account-service.js");
  });

  expect(accountPages.sort()).toEqual(["account.html", "memberships.html", "redeem.html"]);
  for (const name of accountPages) {
    const source = fs.readFileSync(path.join(siteRoot, name), "utf8");
    const runtimeIndex = source.indexOf("lottomind-runtime-config.js");
    const serviceIndex = source.indexOf("lottomind-account-service.js");
    expect(runtimeIndex, `${name} must load the runtime config`).toBeGreaterThan(-1);
    expect(runtimeIndex, `${name} must configure Supabase before the account client`).toBeLessThan(serviceIndex);
  }

  const runtimeConfig = fs.readFileSync(path.join(siteRoot, "assets", "js", "lottomind-runtime-config.js"), "utf8");
  expect(runtimeConfig).toContain("https://sqdasdbvlkgpbbiyeune.supabase.co");
  expect(runtimeConfig).toContain("sb_publishable_");
  expect(runtimeConfig).not.toMatch(/service[_-]?role|sb_secret_|sk_(?:live|test)_/i);
});
