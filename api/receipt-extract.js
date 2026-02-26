export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Optional protection (only if you set APP_API_SECRET in Vercel)
    const appSecret = process.env.APP_API_SECRET;
    if (appSecret) {
      const got = req.headers["x-app-secret"];
      if (got !== appSecret) return res.status(401).json({ error: "Unauthorized" });
    }

    const { image_base64, image_data_url } = req.body ?? {};
    if ((!image_base64 || typeof image_base64 !== "string") && (!image_data_url || typeof image_data_url !== "string")) {
      return res.status(400).json({ error: "Missing image_base64 or image_data_url" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing OPENAI_API_KEY" });

    // Match your Swift exactly:
    // - model: gpt-4.1-mini
    // - instruction: transcribe all text, preserve line breaks, no interpret
    // - detail: high
    // - temperature: 0
    const dataURL =
      (image_data_url && image_data_url.startsWith("data:image/"))
        ? image_data_url
        : `data:image/jpeg;base64,${image_base64}`;

    const body = {
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Transcribe all text from this receipt image. Plain text only. Preserve line breaks. Do not interpret or summarize."
            },
            {
              type: "input_image",
              image_url: dataURL,
              detail: "high"
            }
          ]
        }
      ],
      temperature: 0,
      // Force text output (prevents empty result issues)
      text: { format: { type: "text" } },
      max_output_tokens: 1200
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });

    // Robust extraction (same idea as your Swift parsing, but more tolerant)
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

    return res.status(200).json({ result: resultText });
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
}
