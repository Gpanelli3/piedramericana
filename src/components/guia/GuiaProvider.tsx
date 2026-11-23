"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { Compass, LayoutGrid, MousePointerClick } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarmoGestMark } from "@/components/marmogest-mark";
import { useAuth } from "@/contexts/AuthContext";
import { setGuiaActiva } from "@/lib/guia/estado";
import { guardarGuiasVistas, leerGuiasVistas } from "@/lib/guia/guia-api";
import {
  GUIA_BIENVENIDA,
  GUIA_GENERAL,
  GUIAS_MODULO,
  guiaModuloClave,
  pasosRecorridoGeneral,
  type PasoGuia,
} from "@/lib/guia/pasos";
import { WORKSPACE_TABS, type WorkspaceTab } from "@/types/workspace";

type GuiaContextValue = {
  iniciarRecorridoGeneral: () => void;
  iniciarGuiaPantalla: () => void;
};

const GuiaContext = createContext<GuiaContextValue | null>(null);

export function useGuia(): GuiaContextValue {
  const ctx = useContext(GuiaContext);
  if (!ctx) throw new Error("useGuia debe usarse dentro de GuiaProvider");
  return ctx;
}

const KNOWN_WS = new Set<WorkspaceTab>(WORKSPACE_TABS);
const tabDesde = (v: string | null): WorkspaceTab =>
  v && KNOWN_WS.has(v as WorkspaceTab) ? (v as WorkspaceTab) : "dashboard";

/** Tiempo para que el menú termine de desplegarse antes de marcar sus ítems. */
const ESPERA_MENU_MS = 380;

const existe = (p: PasoGuia) => !p.elemento || document.querySelector(p.elemento) !== null;

export function GuiaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tab = tabDesde(searchParams.get("ws"));
  const ubicacion = searchParams.toString();

  const [vistas, setVistas] = useState<string[] | null>(null);
  const [bienvenidaAbierta, setBienvenidaAbierta] = useState(false);
  const vistasRef = useRef<string[]>([]);
  /** Recorrido en curso: de qué pantalla es (null = general) y cómo cerrarlo. */
  const actual = useRef<{
    tab: WorkspaceTab | null;
    ubicacion: string;
    cerrar: (marcarVista: boolean) => void;
  } | null>(null);
  const ubicacionRef = useRef(ubicacion);
  ubicacionRef.current = ubicacion;

  const meta = user?.user_metadata as { full_name?: string } | undefined;
  const nombre = meta?.full_name?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "";

  useEffect(() => {
    if (!user?.id) return;
    let cancelado = false;
    void leerGuiasVistas(user.id).then((v) => {
      if (cancelado) return;
      vistasRef.current = v;
      setVistas(v);
      if (!v.includes(GUIA_BIENVENIDA)) setBienvenidaAbierta(true);
    });
    return () => {
      cancelado = true;
    };
  }, [user?.id]);

  useEffect(() => () => actual.current?.cerrar(false), []);

  // Si se cambia de pantalla con una mini-guía abierta, se cierra sin darla por vista.
  useEffect(() => {
    const a = actual.current;
    if (a && a.tab !== null && a.ubicacion !== ubicacion) a.cerrar(false);
  }, [ubicacion]);

  const marcar = useCallback(
    (clave: string) => {
      if (!user?.id || vistasRef.current.includes(clave)) return;
      const next = [...vistasRef.current, clave];
      vistasRef.current = next;
      setVistas(next);
      void guardarGuiasVistas(user.id, next);
    },
    [user?.id],
  );

  const correr = useCallback(
    (
      pasos: PasoGuia[],
      opts: { tab: WorkspaceTab | null; expandirMenu?: boolean; alTerminar: () => void },
    ) => {
      actual.current?.cerrar(false);
      if (opts.expandirMenu) setGuiaActiva(true);

      const arrancar = () => {
        const visibles = pasos.filter(existe);
        if (visibles.length === 0) {
          setGuiaActiva(false);
          return;
        }
        // Solo se sale con la X o con "Terminar": un click suelto afuera no corta el recorrido.
        let cierrePedido = false;
        let marcarAlCerrar = true;
        const d: Driver = driver({
          disableActiveInteraction: true,
          onCloseClick: () => {
            cierrePedido = true;
            d.destroy();
          },
          onDestroyStarted: () => {
            if (cierrePedido || !d.hasNextStep()) d.destroy();
          },
          steps: visibles.map((p) => ({
            element: p.elemento,
            popover: {
              title: p.titulo,
              description: p.texto,
              side: p.lado,
              align: "start",
            },
          })),
          showProgress: visibles.length > 1,
          progressText: "{{current}} de {{total}}",
          nextBtnText: "Siguiente",
          prevBtnText: "Anterior",
          doneBtnText: "Terminar",
          overlayColor: "#1c1917",
          overlayOpacity: 0.42,
          stagePadding: 6,
          stageRadius: 12,
          popoverClass: "guia-popover",
          popoverOffset: 12,
          // Sin scroll animado: con la animación, el marco se dibujaba donde estaba el
          // elemento antes de moverse (p. ej. los últimos módulos del menú).
          smoothScroll: false,
          onHighlightStarted: (el) => {
            el?.scrollIntoView({ block: "nearest", inline: "nearest" });
          },
          onHighlighted: () => {
            window.requestAnimationFrame(() => d.refresh());
          },
          onDestroyed: () => {
            actual.current = null;
            setGuiaActiva(false);
            // El recorrido baja por el menú: al terminar, vuelve arriba (logo y usuario).
            if (opts.expandirMenu) document.querySelector("aside")?.scrollTo({ top: 0 });
            if (marcarAlCerrar) opts.alTerminar();
          },
        });
        actual.current = {
          tab: opts.tab,
          ubicacion: ubicacionRef.current,
          cerrar: (marcarVista) => {
            marcarAlCerrar = marcarVista;
            cierrePedido = true;
            d.destroy();
          },
        };
        d.drive();
      };

      if (opts.expandirMenu) window.setTimeout(arrancar, ESPERA_MENU_MS);
      else arrancar();
    },
    [],
  );

  const iniciarRecorridoGeneral = useCallback(() => {
    correr(pasosRecorridoGeneral(nombre || "bienvenido"), {
      tab: null,
      expandirMenu: true,
      alTerminar: () => marcar(GUIA_GENERAL),
    });
  }, [correr, marcar, nombre]);

  const iniciarGuiaPantalla = useCallback(() => {
    const pasos = GUIAS_MODULO[tab];
    if (!pasos || !pasos.some((p) => p.elemento && document.querySelector(p.elemento))) {
      toast.info("Esta pantalla todavía no tiene guía. Podés ver el recorrido general.");
      return;
    }
    correr(pasos, { tab, alTerminar: () => marcar(guiaModuloClave(tab)) });
  }, [correr, marcar, tab]);

  // Primera vez en un módulo: muestra su mini-guía (solo si ya pasó la bienvenida).
  useEffect(() => {
    if (!vistas || !vistas.includes(GUIA_BIENVENIDA) || bienvenidaAbierta) return;
    const pasos = GUIAS_MODULO[tab];
    const clave = guiaModuloClave(tab);
    if (!pasos || vistas.includes(clave)) return;
    const t = window.setTimeout(() => {
      if (actual.current) return;
      // Solo si la pantalla ya muestra todo lo que la guía marca (p. ej. la sección correcta).
      if (!pasos.every((p) => p.opcional || existe(p))) return;
      correr(pasos, { tab, alTerminar: () => marcar(clave) });
    }, 700);
    return () => window.clearTimeout(t);
  }, [tab, ubicacion, vistas, bienvenidaAbierta, correr, marcar]);

  const cerrarBienvenida = (empezar: boolean) => {
    setBienvenidaAbierta(false);
    marcar(GUIA_BIENVENIDA);
    if (empezar) {
      iniciarRecorridoGeneral();
    } else {
      toast("Cuando quieras, la guía está en el menú, abajo de todo.");
    }
  };

  const valor = useMemo(
    () => ({ iniciarRecorridoGeneral, iniciarGuiaPantalla }),
    [iniciarRecorridoGeneral, iniciarGuiaPantalla],
  );

  return (
    <GuiaContext.Provider value={valor}>
      {children}
      <Dialog open={bienvenidaAbierta} onOpenChange={(o) => !o && cerrarBienvenida(false)}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="items-center text-center sm:items-center sm:text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
              <MarmoGestMark className="h-6 w-6 text-accent-foreground" />
            </div>
            <DialogTitle className="text-xl">
              {nombre ? `Hola ${nombre}, bienvenido a MarmoGest` : "Bienvenido a MarmoGest"}
            </DialogTitle>
            <DialogDescription>
              En dos minutos te mostramos dónde está cada cosa.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-3 py-2 text-sm">
            <li className="flex items-start gap-3">
              <LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Recorremos cada módulo del menú y para qué sirve.</span>
            </li>
            <li className="flex items-start gap-3">
              <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Al entrar por primera vez a cada pantalla, te marcamos sus botones principales.</span>
            </li>
            <li className="flex items-start gap-3">
              <Compass className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Podés repetir la guía cuando quieras desde el menú.</span>
            </li>
          </ul>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => cerrarBienvenida(false)}>
              Ahora no
            </Button>
            <Button type="button" onClick={() => cerrarBienvenida(true)}>
              Empezar recorrido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GuiaContext.Provider>
  );
}
