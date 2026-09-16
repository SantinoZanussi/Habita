import { calcularMora, diasCorridos } from './mora.js';
import { errores } from '../infra/errores.js';

const fecha = (v) => v?.toDate ? v.toDate() : new Date(v);

// Los comprobantes antiguos con arrastre requieren conciliacion, no una resta ciega.
export function deudaDePeriodo({ detalle, periodo, complejo, hasta = new Date() }) {
  if (detalle.versionCuenta !== 2 && (detalle.saldoAnterior > 0 || detalle.interesesMora > 0)) {
    throw errores.conflicto('Esta cuenta requiere conciliacion de liquidaciones anteriores antes de operar.', {
      periodoId: periodo.id, unidadId: detalle.unidadId,
    });
  }
  const capital = Math.max(0, Number(detalle.saldoPendiente ?? 0));
  const pendiente = Math.max(0, Number(detalle.interesesPendientes ?? 0));
  const vencimiento = fecha(periodo.vencimiento);
  const inicio = new Date(vencimiento);
  inicio.setUTCDate(inicio.getUTCDate() + Number(complejo.diasGraciaMora ?? 0));
  const corte = detalle.moraCalculadaHasta ? fecha(detalle.moraCalculadaHasta) : inicio;
  const desde = corte > inicio ? corte : inicio;
  const generado = Number(detalle.interesesGenerados ?? 0);
  const base = capital + (complejo.modoMora === 'compuesta' ? pendiente : 0);
  let nuevo = calcularMora({
    saldoCentavos: base, vencimiento: desde, fechaCalculo: hasta,
    tasaMensualPorcentaje: complejo.tasaMoraMensual ?? 0,
    modo: complejo.modoMora ?? 'simple',
  }).interesCentavos;
  if (complejo.topeMoraPorcentaje > 0) {
    const tope = Math.round((detalle.subtotalPeriodo ?? detalle.totalAPagar ?? capital) * complejo.topeMoraPorcentaje / 100);
    nuevo = Math.min(nuevo, Math.max(0, tope - generado));
  }
  return {
    periodoId: periodo.id, vencimiento, saldoCentavos: capital,
    interesesCentavos: pendiente + nuevo, interesesGenerados: generado + nuevo,
    dias: capital + pendiente + nuevo > 0 ? Math.max(0, diasCorridos(vencimiento, hasta)) : 0,
  };
}
