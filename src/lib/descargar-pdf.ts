/** Descarga un elemento HTML como PDF (sin abrir el diálogo de imprimir). */

import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export function nombreArchivoPdf(base: string): string {
  const limpio = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 120);
  const name = limpio || "documento";
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

export function descargarBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function elementoComoPdfBlob(
  elemento: HTMLElement,
  nombreArchivo: string,
): Promise<{ blob: Blob; filename: string }> {
  const canvas = await html2canvas(elemento, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone(_doc, cloned) {
      cloned.style.boxShadow = "none";
      cloned.style.maxHeight = "none";
      cloned.style.overflow = "visible";
    },
  });

  if (canvas.width < 8 || canvas.height < 8) {
    throw new Error("No se pudo generar el PDF del documento.");
  }

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0.5) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const filename = nombreArchivoPdf(nombreArchivo);
  return { blob: pdf.output("blob"), filename };
}

export async function descargarElementoComoPdf(
  elemento: HTMLElement,
  nombreArchivo: string,
): Promise<void> {
  const { blob, filename } = await elementoComoPdfBlob(elemento, nombreArchivo);
  descargarBlob(blob, filename);
}

export function puedeCompartirArchivo(file: File): boolean {
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
  };
  if (typeof nav.canShare !== "function") return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}
