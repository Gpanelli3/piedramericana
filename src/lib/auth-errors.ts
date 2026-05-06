import type { AuthError } from "@supabase/supabase-js";

/** Mensajes legibles para errores comunes de Supabase Auth (la API suele responder en inglés). */
export function formatAuthError(error: AuthError): string {
  const code = error.status ?? 0;
  const msg = error.message.toLowerCase();

  if (msg.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos. Si no tienes cuenta, pide acceso a un administrador.";
  }
  if (msg.includes("email not confirmed")) {
    return "Debes confirmar tu correo antes de poder entrar.";
  }
  if (msg.includes("too many requests") || code === 429) {
    return "Demasiados intentos. Espera un momento y vuelve a intentar.";
  }

  return error.message;
}
