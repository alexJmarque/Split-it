export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: "Missing text" });

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `Extract items and prices from this receipt text and return JSON with {items:[{name,price}], subtotal, tax, tip, total}.\n\nReceipt:\n${text}`,
      }),
    });

    const data = await r.json();

    // The Responses API returns output text in a structured way; simplest is:
    const outputText =
      data?.output?.[0]?.content?.[0]?.text || JSON.stringify(data);

    return res.status(200).json({ result: outputText });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
