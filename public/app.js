const form = document.getElementById("contractForm");
const result = document.getElementById("result");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  result.textContent = "Generando contrato...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      result.textContent = data.error || "Error al generar el contrato.";
      return;
    }

    result.textContent = data.contract || "No se pudo generar el contrato.";
  } catch (error) {
    result.textContent = "Error de conexión al generar el contrato.";
  }
});

function downloadPDF() {
  const element = document.getElementById("result");
  html2pdf().from(element).save("contrato-arrendamiento.pdf");
}

window.downloadPDF = downloadPDF;
