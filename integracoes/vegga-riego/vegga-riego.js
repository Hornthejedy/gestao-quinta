import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CONFIG = {
  username: process.env.VEGGA_USERNAME || "",
  password: process.env.VEGGA_PASSWORD || "",
  signInUrl: "https://app.veggadigital.com/authentication/sign-in",
  unitId: "4891",
  programNumber: "19",
  programName: "Testes",
  artifactsDir: path.join(scriptDir, "artifacts")
};

async function readLocalConfig() {
  const localPath = path.join(scriptDir, "config.local.json");
  try {
    const raw = await fs.readFile(localPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function configWithCredentials(options) {
  const local = await readLocalConfig();
  const config = { ...DEFAULT_CONFIG, ...local, ...options };
  if (!config.username || !config.password) {
    throw new Error("Faltam credenciais Vegga. Define VEGGA_USERNAME/VEGGA_PASSWORD ou cria integracoes/vegga-riego/config.local.json.");
  }
  return config;
}

async function login(page, config) {
  await page.goto(config.signInUrl, { waitUntil: "domcontentloaded" });
  await page.locator('vegga-input[name="username"] input').fill(config.username);
  await page.locator('vegga-input[name="password"] input').fill(config.password);
  await page.locator("vegga-button.gtm--sign-in-sign-in").click();
  await page.waitForURL("**/home", { timeout: 45000 });
}

async function openCabecosPrograms(page) {
  await page.getByText("Control de riego", { exact: true }).click();
  await page.getByText("Equipos", { exact: true }).click();
  await page.waitForURL("**/irrigation-control/units", { timeout: 45000 });
  await page.getByText(/CABE[CÇ]OS/i).first().click();
  await page.waitForURL("**/irrigation-control/unit/*/programs", { timeout: 45000 });
}

async function openProgram(page, config) {
  const searchInput = page.locator("vegga-input input").first();
  await searchInput.waitFor({ state: "visible", timeout: 60000 });
  await searchInput.fill(config.programName);
  await page.waitForTimeout(3000);

  const programCell = page.locator("vegga-data-grid-cell").filter({ hasText: config.programName }).first();
  await programCell.waitFor({ state: "visible", timeout: 60000 });
  await programCell.click();

  await page.waitForURL("**/irrigation-control/unit/*/programs/detail/*", { timeout: 45000 });
  await page.waitForFunction(
    ({ programNumber, programName }) =>
      location.href.endsWith(`/detail/${programNumber}`) ||
      document.body.innerText.includes(`${programNumber} - ${programName}`),
    { programNumber: config.programNumber, programName: config.programName }
  );
}

async function openSp1Editor(page) {
  await page.getByText("Edición", { exact: true }).first().click();
  await page.waitForFunction(() => document.body.innerText.includes("SUB-PROGRAMAS"));

  const editPanel = page.locator("vegga-overlay-content").filter({ hasText: "SUB-PROGRAMAS" }).first();
  await editPanel.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  const sp1Row = editPanel
    .locator("vegga-data-grid-row2")
    .filter({ hasText: /^SP1\b/i })
    .first();

  await sp1Row.waitFor({ state: "visible", timeout: 60000 });
  await sp1Row.click();
  await page.waitForFunction(() => document.body.innerText.includes("Sub-programa 1"));
}

async function selectRiegoUnit(page, unit) {
  const normalizedUnit = String(unit).toLowerCase();
  const unitText = normalizedUnit.includes("h") || normalizedUnit.includes("tempo")
    ? "Horas - Minutos"
    : "Metros cúbicos";

  const currentUnit = page.locator("vegga-dropdown").filter({ hasText: /Metros c|Horas - Minutos/i }).first();
  if (await currentUnit.getByText(unitText, { exact: false }).count()) {
    return;
  }

  await currentUnit.click();
  await page.getByText(unitText, { exact: false }).last().click();
}

async function setRiegoAndSave(page, value, unit) {
  await selectRiegoUnit(page, unit);
  const displayValue = String(value).replace(",", ".");

  const riegoInput = page
    .locator("vegga-input")
    .filter({ hasText: /^Riego\b/i })
    .last()
    .locator("input");

  await riegoInput.waitFor({ state: "visible", timeout: 60000 });
  await riegoInput.click();
  await riegoInput.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await riegoInput.fill(displayValue);
  await riegoInput.evaluate((input) => {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  });

  await page.getByText("Aceptar", { exact: true }).click();
  await page.waitForFunction(() => !document.body.innerText.includes("Sub-programa 1"));

  const saveButton = page.getByRole("button", { name: "Guardar" }).last();
  await saveButton.waitFor({ state: "visible", timeout: 60000 });
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll("button")];
    const save = buttons.reverse().find(btn => (btn.textContent || "").trim() === "Guardar");
    if (!save) return false;
    const disabled = save.disabled
      || save.hasAttribute("disabled")
      || save.getAttribute("aria-disabled") === "true"
      || save.className.includes("disabled");
    return !disabled;
  }, null, { timeout: 15000 }).catch(() => {});
  await saveButton.click({ force: true });
  await page.waitForTimeout(8000);
}

async function verifySavedValue(page, config) {
  const value = config.value;
  const unit = config.unit || "m3";
  const expectedValue = Number(value).toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 1,
    maximumFractionDigits: 1
  });
  const unitPattern = String(unit).toLowerCase().includes("h") ? /hh:mm/i : /m[³3]/i;
  if (!/\/programs\/detail\//.test(page.url())) {
    await openProgram(page, config);
  }
  await page.getByText("Edición", { exact: true }).first().click();
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes("SUB-PROGRAMAS"));
  const editPanel = page.locator("vegga-overlay-content").filter({ hasText: "SUB-PROGRAMAS" }).first();
  await editPanel.waitFor({ state: "visible", timeout: 30000 });
  await editPanel.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const sp1Row = editPanel.locator("vegga-data-grid-row2").filter({ hasText: /^SP1\b/i }).first();
  await sp1Row.waitFor({ state: "visible", timeout: 30000 });
  const rowText = (await sp1Row.innerText()).replace(/\s+/g, " ");
  if (!rowText.includes("S5") || !rowText.includes(expectedValue) || !unitPattern.test(rowText)) {
    throw new Error(`Valor nao confirmado no Vegga. Linha SP1: ${rowText}`);
  }
}

export async function saveTestesSp1Riego(options) {
  const config = await configWithCredentials(options);

  if (!config.value) {
    throw new Error("Missing required option: value");
  }

  await fs.mkdir(config.artifactsDir, { recursive: true });

  const browser = await chromium.launch({ headless: config.headless !== false });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    acceptDownloads: true
  });

  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  try {
    await login(page, config);
    await openCabecosPrograms(page);
    await openProgram(page, config);
    await openSp1Editor(page);
    await setRiegoAndSave(page, config.value, config.unit || "m3");
    await verifySavedValue(page, config);

    const screenshotPath = path.join(config.artifactsDir, "vegga-riego-saved.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });

    return {
      ok: true,
      value: config.value,
      unit: config.unit || "m3",
      program: `${config.programNumber} - ${config.programName}`,
      subprogram: "SP1",
      sector: "S5",
      finalUrl: page.url(),
      screenshotPath
    };
  } catch (error) {
    const screenshotPath = path.join(config.artifactsDir, "vegga-riego-error.png");
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    error.screenshotPath = screenshotPath;
    throw error;
  } finally {
    await browser.close();
  }
}
