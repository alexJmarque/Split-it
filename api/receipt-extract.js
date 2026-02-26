export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { text } = req.body ?? {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing text" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing OPENAI_API_KEY" });

    // Strong JSON-only instruction
    const instruction = `
You MUST return ONLY valid JSON (no markdown, no commentary).
Schema:
{
  "merchant": string|null,
  "date": string|null,
  "currency": string|null,
  "items": [
    { "name": string, "qty": number|null, "unit_price": number|null, "total": number|null }
  ],
  "subtotal": number|null,
  "tax": number|null,
  "tip": number|null,
  "total": number|null
}
Rules:
- No extra keys.
- Numbers must be numbers (not strings).
- If unknown, use null.
- If qty is not present, set qty to 1.
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
        // ✅ Force text output so we can reliably extract it
        text: { format: { type: "text" } },
        max_output_tokens: 700,
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });

    // ✅ Robust extraction (same style as summary fix)
    let resultText = (data.output_text ?? "").trim();

    if (!resultText && Array.isArray(data.output)) {
      let combined = "";
      for (const item of data.output) {
        if (item.type === "message" && Array.isArray(item.content)) {
          for (const part of item.content) {
            if ((part.type === "output_text" || part.type === "text") && typeof part.text === "string") {
              combined += part.text;
            }
          }
        }
      }
      resultText = combined.trim();
    }

    // Optional: validate it is JSON before returning (nice for debugging)
    // If it fails, return the raw text so you can see what happened.
    try {
      JSON.parse(resultText);
    } catch {
      return res.status(200).json({
        result: resultText,
        warning: "Model did not return valid JSON. See raw result above.",
      });
    }

    return res.status(200).json({ result: resultText });
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
}
