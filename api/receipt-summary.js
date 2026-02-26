export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const appSecret = process.env.APP_API_SECRET;
    if (appSecret) {
      const got = req.headers["x-app-secret"];
      if (got !== appSecret) return res.status(401).json({ error: "Unauthorized" });
    }

    const { text } = req.body ?? {};
    if (!text || typeof text !== "string") return res.status(400).json({ error: "Missing text" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing OPENAI_API_KEY" });

    // EXACT same content as your Swift file (system + user instructions)
    const prompt =
`You are a helpful assistant that analyzes receipt information.

Analyze the following receipt text and extract the following information:
- List of items ordered with their names, quantities, and prices
- When there are multiple times the same item, update the quantities and put the total price (quantity * item)
- Tax amount; if it's shown in percentage, do the math to find the amount.
- Name of the place

Format the output without any spaces between categories, as follows:
ITEMS:
item_name//quantity//price
item_name//quantity//price
...
TAX:
tax_amount
PLACE_NAME:
name_place

Important notes:
1. Do not confuse tip with tax.
2. Do not include any line breaks between categories.
3. Double-check that the item prices and quantities make sense (OCR text can be inaccurate/unstructured).
4. At the end, double-check your answer: sum(price*quantity) should match the total amount.
5. When there is a reduction, directly apply the reduction on the correct item.

Receipt text:
${text}`;

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        temperature: 0.1,
        max_output_tokens: 1000,
        text: { format: { type: "text" } }
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });

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
