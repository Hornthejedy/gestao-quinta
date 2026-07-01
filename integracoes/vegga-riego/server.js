import http from "node:http";
import { saveTestesSp1Riego } from "./vegga-riego.js";

const PORT = Number(process.env.VEGGA_RIEGO_PORT || 8787);

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 100000) {
        req.destroy();
        reject(new Error("Pedido demasiado grande."));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true, service: "vegga-riego", program: "19 - Testes", subprogram: "SP1", sector: "S5" });
  }

  if (req.method !== "POST" || req.url !== "/save-riego") {
    return sendJson(res, 404, { ok: false, error: "Rota nao encontrada." });
  }

  try {
    const body = await readBody(req);
    const data = JSON.parse(body || "{}");
    const value = Number(data.value);
    const unit = data.unit || "m3";

    if (!Number.isFinite(value) || value <= 0) {
      return sendJson(res, 400, { ok: false, error: "Valor de rega invalido." });
    }

    const result = await saveTestesSp1Riego({ value, unit });
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error.message,
      screenshotPath: error.screenshotPath || null
    });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Servico Vegga Riego ativo em http://127.0.0.1:${PORT}`);
  console.log("Limite atual: Programa 19 - Testes, SP1, setor S5.");
});
