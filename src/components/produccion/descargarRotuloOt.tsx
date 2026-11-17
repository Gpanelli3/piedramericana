import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { RotuloOtDocumento } from "@/components/produccion/RotuloOtDocumento";
import { descargarElementoComoPdf } from "@/lib/descargar-pdf";
import { fetchRotuloOt } from "@/lib/rotulo-ot-api";

/** Arma el rótulo fuera de pantalla y lo baja como PDF, sin abrir otra vista. */
export async function descargarRotuloOt(otId: string): Promise<{ error: Error | null }> {
  const res = await fetchRotuloOt(otId);
  if (res.error || !res.data) {
    return { error: res.error ?? new Error("No se pudo armar el rótulo.") };
  }

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.left = "0";
  host.style.top = "0";
  host.style.width = "210mm";
  host.style.background = "#ffffff";
  host.style.zIndex = "-1";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);

  const root = createRoot(host);
  flushSync(() => {
    root.render(
      <div style={{ width: "210mm", background: "#ffffff" }}>
        <RotuloOtDocumento datos={res.data!} />
      </div>,
    );
  });

  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const el = host.firstElementChild;
    if (!(el instanceof HTMLElement)) {
      return { error: new Error("No se pudo generar el PDF del rótulo.") };
    }
    const base = [res.data.presupuestoNumero, res.data.titulo].filter(Boolean).join("_");
    await descargarElementoComoPdf(el, `Rotulo_${base || "OT"}`);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error("No se pudo descargar el rótulo.") };
  } finally {
    root.unmount();
    host.remove();
  }
}
