export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { text } = req.body ?? {};
    if (!text || typeof text !== "string") return res.status(400).json({ error: "Missing text" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing OPENAI_API_KEY" });

    const instruction = `
Write a short receipt summary in plain text:
- Merchant (if available)
- Total (if available)
- 3 notable line items (or fewer if not available)
No markdown. Keep it concise.
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
        // ✅ Force text output so response.output_text is populated
        text: { format: { type: "text" } },
        max_output_tokens: 300,
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });

    // ✅ Robust extraction
    let resultText = (data.output_text ?? "").trim();

    if (!resultText && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === "message" && Array.isArray(item.content)) {
          for (const part of item.content) {
            // parts often look like { type: "output_text", text: "..." } or similar
            if ((part.type === "output_text" || part.type === "text") && typeof part.text === "string") {
              resultText += part.text;
            }
          }
        }
      }
      resultText = resultText.trim();
    }

    return res.status(200).json({ result: resultText });
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
}
