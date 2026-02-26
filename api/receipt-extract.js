export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Optional: protect endpoint
  const appSecret = process.env.APP_API_SECRET;
  if (appSecret) {
    const got = req.headers["x-app-secret"];
    if (got !== appSecret) return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { text } = req.body ?? {};
    if (!text || typeof text !== "string") return res.status(400).json({ error: "Missing text" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing OPENAI_API_KEY" });

    const instruction = `
You MUST return ONLY valid JSON (no markdown, no commentary).
Schema:
{
  "merchant": string|null,
  "date": string|null,
  "currency": string|null,
  "items": [{"name": string, "qty": number|null, "unit_price": number|null, "total": number|null}],
  "subtotal": number|null,
  "tax": number|null,
  "tip": number|null,
  "total": number|null
}
Rules:
- No extra keys.
- Numbers must be numbers (not strings).
- If unknown, use null.
`;

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `${instruction}\n\nRECEIPT TEXT:\n${text}`,
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });

    const resultText = data.output_text ?? "";
    return res.status(200).json({ result: resultText });
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
}
