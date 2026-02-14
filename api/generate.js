import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.CONTRA,
});

const SYSTEM_PROMPT = `You are a legal drafting assistant specialized in residential lease agreements in Spain.
Write a complete rental contract compliant with common Spanish practice (LAU).
Do not explain anything.
Return only the contract text.`;

function buildUserPrompt(data) {
  return `Generate a Spanish rental agreement with:

ARRENDADOR: ${data.landlord ?? ""}
ARRENDATARIO: ${data.tenant ?? ""}
DIRECCIÓN DEL INMUEBLE: ${data.address ?? ""}
CIUDAD: ${data.city ?? ""}
RENTA MENSUAL: ${data.rent ?? ""}
FIANZA: ${data.deposit ?? ""}
DURACIÓN: ${data.duration ?? ""}
FECHA DE INICIO: ${data.startDate ?? ""}
DESTINO DEL INMUEBLE: ${data.use ?? ""}
CONDICIONES ADICIONALES: ${data.extras ?? ""}

Include:
• Identificación de las partes
• Descripción del inmueble
• Duración y prórrogas (LAU style)
• Renta, actualización y forma de pago
• Fianza legal
• Gastos y suministros
• Obligaciones de arrendador y arrendatario
• Resolución del contrato
• Legislación aplicable en España
• Firma de las partes

Return plain formatted text.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload =
      typeof req.body === "string" && req.body.length > 0
        ? JSON.parse(req.body)
        : req.body || {};

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(payload) },
      ],
      temperature: 0.2,
    });

    const contract = completion.choices?.[0]?.message?.content?.trim() || "";

    return res.status(200).json({ contract });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to generate contract",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
