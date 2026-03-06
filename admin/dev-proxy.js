import { createServer } from "node:http";

const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = process.env;

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.error("Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET in .env");
  process.exit(1);
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/token") {
    try {
      const body = await readBody(req);
      const { code } = JSON.parse(body);

      const ghRes = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code,
          }),
        }
      );

      const data = await ghRes.json();

      if (data.error) {
        res.writeHead(400, {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
        });
        res.end(
          JSON.stringify({ error: data.error_description ?? data.error })
        );
        return;
      }

      res.writeHead(200, {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ access_token: data.access_token }));
    } catch (err) {
      res.writeHead(500, {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(8788, () => {
  console.log("OAuth dev proxy listening on http://localhost:8788");
});
