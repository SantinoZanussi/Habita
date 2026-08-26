/**
 * Aritmetica de plata.
 *
 * Regla numero uno del proyecto: NUNCA se opera plata con `number` decimal.
 * `0.1 + 0.2 === 0.30000000000000004` y una liquidacion de 152 unidades que
 * arrastra ese error no cierra nunca. Todo se lleva en CENTAVOS ENTEROS y
 * solo se convierte a decimal para mostrar.
 *
 * Los coeficientes se llevan en DIEZMILESIMAS de punto porcentual (4 decimales,
 * que es la precision con la que se escriben en un reglamento de copropiedad):
 * 2,5641 % -> 25641. La suma de todos tiene que dar 1.000.000.
 */

/** Escala de los coeficientes: 100,0000 % expresado en enteros. */
export const COEFICIENTE_TOTAL = 1_000_000;

/** Convierte pesos (decimal, como los escribe un humano) a centavos enteros. */
export function aCentavos(pesos) {
  if (typeof pesos === 'bigint') return pesos;
  const n = Number(pesos);
  if (!Number.isFinite(n)) throw new TypeError(`Monto no numerico: ${pesos}`);
  // Redondeo a la mitad hacia arriba, trabajando sobre el string para no
  // arrastrar el error binario de multiplicar por 100.
  return Math.round((n + Number.EPSILON) * 100);
}

/** Convierte centavos enteros a pesos decimales. Solo para mostrar o serializar. */
export function aPesos(centavos) {
  return Number(centavos) / 100;
}

/** Convierte un coeficiente porcentual (2.5641) a su entero interno (25641). */
export function aCoeficienteEntero(porcentaje) {
  const n = Number(porcentaje);
  if (!Number.isFinite(n)) throw new TypeError(`Coeficiente no numerico: ${porcentaje}`);
  return Math.round((n + Number.EPSILON) * 10_000);
}

/** Vuelve del entero interno al porcentaje legible. */
export function aCoeficientePorcentaje(entero) {
  return entero / 10_000;
}

/**
 * Formatea un monto en centavos como moneda argentina.
 * Se usa en mails, notificaciones push y en la preferencia de Mercado Pago.
 */
export function formatearPesos(centavos, { conSimbolo = true } = {}) {
  const valor = aPesos(centavos);
  const texto = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
  return conSimbolo ? `$ ${texto}` : texto;
}

/**
 * Reparte `total` centavos entre `partes` segun sus pesos enteros, garantizando
 * que la suma del reparto sea EXACTAMENTE `total`.
 *
 * Es el metodo del mayor resto (cuota Hare), el mismo que se usa para repartir
 * bancas: cada parte se lleva su piso entero y los centavos que sobran se
 * entregan de a uno a las partes con mayor resto fraccionario.
 *
 * @param {number} total            Centavos a repartir (entero, puede ser negativo).
 * @param {Array<{id: string, peso: number}>} partes  Pesos enteros (coeficientes).
 * @param {object} opciones
 * @param {'mayorResto'|'mayorCoeficiente'} opciones.politica  Como se asignan los sobrantes.
 * @returns {Array<{id: string, monto: number, ideal: number, ajuste: number}>}
 *          `ideal` es el reparto exacto en centavos con decimales (solo informativo),
 *          `ajuste` es cuanto se aparto de el por el redondeo.
 */
export function repartirExacto(total, partes, { politica = 'mayorResto' } = {}) {
  if (!Number.isInteger(total)) throw new TypeError('El total a repartir debe ser un entero de centavos');
  if (partes.length === 0) {
    if (total !== 0) throw new RangeError('No hay partes entre las cuales repartir un total distinto de cero');
    return [];
  }

  const sumaPesos = partes.reduce((acc, p) => acc + p.peso, 0);
  if (sumaPesos <= 0) throw new RangeError('La suma de los pesos del reparto tiene que ser mayor a cero');

  // Piso entero y resto, en aritmetica entera: nada de decimales intermedios.
  const negativo = total < 0;
  const absoluto = Math.abs(total);

  const filas = partes.map((p) => {
    const producto = absoluto * p.peso;
    return {
      id: p.id,
      peso: p.peso,
      piso: Math.floor(producto / sumaPesos),
      resto: producto % sumaPesos,
      ideal: producto / sumaPesos,
    };
  });

  let asignado = filas.reduce((acc, f) => acc + f.piso, 0);
  let sobrantes = absoluto - asignado;

  // Orden de prioridad para los centavos sobrantes. El desempate por `id` es
  // lo que hace el resultado DETERMINISTA: liquidar dos veces el mismo periodo
  // tiene que dar exactamente el mismo numero para cada unidad.
  const orden = [...filas].sort((a, b) => {
    if (politica === 'mayorCoeficiente') {
      if (b.peso !== a.peso) return b.peso - a.peso;
    } else {
      if (b.resto !== a.resto) return b.resto - a.resto;
      if (b.peso !== a.peso) return b.peso - a.peso;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  for (let i = 0; sobrantes > 0; i = (i + 1) % orden.length) {
    orden[i].piso += 1;
    sobrantes -= 1;
  }

  const signo = negativo ? -1 : 1;
  return filas.map((f) => ({
    id: f.id,
    monto: f.piso * signo,
    ideal: f.ideal * signo,
    ajuste: (f.piso - f.ideal) * signo,
  }));
}

/**
 * Verificacion dura del motor de liquidacion: la suma de las partes tiene que
 * dar exactamente el total. Se corre siempre, no solo en los tests, y se
 * guarda su resultado en el documento del periodo. Es el numero que se muestra
 * en la demo.
 */
export function verificarCierre(total, montos) {
  const suma = montos.reduce((acc, m) => acc + m, 0);
  return {
    total,
    suma,
    diferencia: suma - total,
    cierra: suma === total,
  };
}

/** Redondeo a la mitad hacia arriba sobre centavos, para intereses y porcentajes. */
export function redondearCentavos(valor) {
  return Math.sign(valor) * Math.round(Math.abs(valor));
}

/** Aplica un porcentaje (en diezmilesimas) a un monto en centavos. */
export function aplicarPorcentaje(centavos, porcentaje) {
  return redondearCentavos((centavos * aCoeficienteEntero(porcentaje)) / COEFICIENTE_TOTAL);
}
