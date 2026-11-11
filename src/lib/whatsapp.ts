/**
 * Arma un enlace de WhatsApp a partir de un teléfono tal como está cargado.
 * Los números argentinos sin código de país (o sin el 9 de celular) se
 * normalizan a 549… para que wa.me abra el chat correcto.
 */
export function urlWhatsapp(tel: string): string | null {
  const digitos = digitosWhatsapp(tel);
  return digitos ? `https://wa.me/${digitos}` : null;
}

export function digitosWhatsapp(tel: string): string | null {
  let d = tel.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);

  if (d.startsWith("54")) {
    if (d.startsWith("540")) d = `54${d.slice(3)}`;
    if (d.length === 12 && !d.startsWith("549")) d = `549${d.slice(2)}`;
  } else {
    if (d.startsWith("0")) d = d.slice(1);
    const conQuince = d.match(/^(\d{2,4})15(\d{6,8})$/);
    if (conQuince) d = `549${conQuince[1]}${conQuince[2]}`;
    else if (d.length === 10) d = `549${d}`;
  }

  if (d.length < 8 || d.length > 15) return null;
  return d;
}
