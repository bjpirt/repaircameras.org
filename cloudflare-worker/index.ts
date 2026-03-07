interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ALLOWED_ORIGIN: string;
}

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(env.ALLOWED_ORIGIN);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (
      request.method === "POST" &&
      new URL(request.url).pathname === "/auth/token"
    ) {
      try {
        const { code } = await request.json<{ code: string }>();

        const ghRes = await fetch(
          "https://github.com/login/oauth/access_token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              client_id: env.GITHUB_CLIENT_ID,
              client_secret: env.GITHUB_CLIENT_SECRET,
              code,
            }),
          }
        );

        const data = await ghRes.json<{
          access_token?: string;
          error?: string;
          error_description?: string;
        }>();

        if (data.error) {
          return Response.json(
            { error: data.error_description ?? data.error },
            { status: 400, headers }
          );
        }

        return Response.json(
          { access_token: data.access_token },
          { status: 200, headers }
        );
      } catch {
        return Response.json(
          { error: "Internal server error" },
          { status: 500, headers }
        );
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
