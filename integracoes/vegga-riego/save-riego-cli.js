import { saveTestesSp1Riego } from "./vegga-riego.js";

const value = process.argv[2];
const unit = process.argv[3] || "m3";

if (!value) {
  console.error("Uso: node save-riego-cli.js <valor> [m3|hh:mm]");
  process.exit(1);
}

try {
  const result = await saveTestesSp1Riego({ value, unit });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  if (error.screenshotPath) {
    console.error(`Captura do erro: ${error.screenshotPath}`);
  }
  process.exit(1);
}
