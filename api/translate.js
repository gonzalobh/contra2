export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  let stage = "init";

  try {
    stage = "parsing_request";
    const { subject, body, language } = req.body || {};
    const safeSubject = typeof subject === "string" ? subject.trim() : "";
    const safeBody = typeof body === "string" ? body.trim() : "";
    const safeLanguage = typeof language === "string" ? language.trim() : "";

    if (!safeSubject || !safeBody) {
      return res.status(400).json({ error: "Solicitud inválida", stage, safeSubject: safeSubject.substring(0, 50), safeBodyLen: safeBody.length });
    }

    const targetLanguage = safeLanguage || "English";

    stage = "calling_openai";
    const systemPrompt = "Eres un traductor profesional de emails. Responde usando el formato exacto indicado, sin explicaciones.";

    const userPrompt = `Traduce al ${targetLanguage}. Mantén el formato, saltos de línea y emojis.

Responde EXACTAMENTE con este formato (usa los delimitadores tal cual):

===SUBJECT===
(asunto traducido aquí)
===BODY===
(cuerpo traducido aquí)
===END===

Asunto original:
${safeSubject}

Cuerpo original:
${safeBody}`;

    const upstreamResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ORTO}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    stage = "checking_openai_response";
    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      return res.status(502).json({ error: "OpenAI failed", stage, status: upstreamResponse.status, details: errorText.substring(0, 300) });
    }

    stage = "parsing_openai_json";
    const data = await upstreamResponse.json();
    const rawContent = data?.choices?.[0]?.message?.content;

    const output =
      typeof rawContent === "string"
        ? rawContent.trim()
        : Array.isArray(rawContent)
          ? rawContent
              .map((part) => (typeof part?.text === "string" ? part.text : ""))
              .join("")
              .trim()
          : "";

    if (!output) {
      return res.status(500).json({ error: "Empty GPT output", stage, rawContentType: typeof rawContent });
    }

    stage = "parsing_delimiters";
    const subjectMatch = output.match(/===SUBJECT===\s*([\s\S]*?)\s*===BODY===/);
    const bodyMatch = output.match(/===BODY===\s*([\s\S]*?)\s*===END===/);

    const translatedSubject = subjectMatch ? subjectMatch[1].trim() : "";
    const translatedBody = bodyMatch ? bodyMatch[1].trim() : "";

    if (!translatedSubject || !translatedBody) {
      return res.status(500).json({ 
        error: "Delimiter parse failed", 
        stage,
        hasSubject: !!subjectMatch,
        hasBody: !!bodyMatch,
        rawOutput: output.substring(0, 500)
      });
    }

    return res.status(200).json({
      translatedSubject,
      translatedBody,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    console.error("Translate endpoint error:", details);

    return res.status(500).json({
      error: "Translation failed",
      stage,
      details,
    });
  }
}
