#!/usr/bin/env node
/**
 * Genera los tokens de diseno para las dos plataformas a partir de brand/tokens.json.
 *   -> web/assets/css/tokens.css           (variables CSS)
 *   -> mobile/lib/nucleo/tema/tokens.dart  (constantes Dart)
 *
 * Se corre con `npm run tokens`. Los archivos generados no se editan a mano:
 * si la marca cambia un color, cambia en un solo lugar y las dos vistas quedan iguales.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const t = JSON.parse(readFileSync(resolve(raiz, 'brand/tokens.json'), 'utf8'));

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const hexDart = (hex) => '0xFF' + hex.replace('#', '').toUpperCase();

const escribir = (rel, contenido) => {
  const destino = resolve(raiz, rel);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, contenido, 'utf8');
  console.log('  generado', rel, '(' + contenido.length + ' bytes)');
};

/* ------------------------------------------------------------------ CSS */

const css = [];
css.push('/* Generado por tools/generar-tokens.mjs desde brand/tokens.json. No editar a mano. */');
css.push(':root {');

css.push('  /* --- color --- */');
for (const [grupo, valores] of Object.entries(t.color)) {
  for (const [clave, def] of Object.entries(valores)) {
    const comentario = def.uso ? ' /* ' + def.uso + ' */' : '';
    css.push('  --color-' + kebab(grupo) + '-' + kebab(clave) + ': ' + def.valor + ';' + comentario);
  }
}

// Alias semanticos: lo que consume la UI. Cambiar un alias reetiqueta todo el producto.
const alias = {
  'fondo': 'var(--color-neutro-50)',
  'superficie': 'var(--color-neutro-0)',
  'superficie-suave': 'var(--color-primario-100)',
  'superficie-alterna': 'var(--color-neutro-100)',
  'borde': 'var(--color-neutro-200)',
  'borde-fuerte': 'var(--color-neutro-300)',
  'borde-marca': 'var(--color-primario-200)',
  'texto': 'var(--color-neutro-900)',
  'texto-suave': 'var(--color-neutro-500)',
  'texto-medio': 'var(--color-neutro-700)',
  'texto-titulo': 'var(--color-azul-700)',
  'texto-invertido': 'var(--color-neutro-0)',
  'marca': 'var(--color-primario-500)',
  'marca-hover': 'var(--color-primario-600)',
  'marca-activo': 'var(--color-primario-700)',
  'lateral': 'var(--color-azul-900)',
  'degrade-marca':
    'linear-gradient(100deg, var(--color-marca-degrade-inicio) 0%, ' +
    'var(--color-marca-degrade-medio) 42%, var(--color-marca-degrade-fin) 100%)',
};
css.push('');
css.push('  /* --- alias semanticos: lo que consume la UI --- */');
for (const [k, v] of Object.entries(alias)) css.push('  --' + k + ': ' + v + ';');

css.push('');
css.push('  /* --- tipografia --- */');
for (const [k, v] of Object.entries(t.tipografia.familia)) {
  css.push('  --fuente-' + kebab(k) + ': ' + v.valor + ';');
}
for (const [k, e] of Object.entries(t.tipografia.escala)) {
  const familia = 'var(--fuente-' + kebab(e.familia) + ')';
  css.push('  --texto-' + kebab(k) + ': ' + e.peso + ' ' + e.tamano + 'px/' + e.alto + ' ' + familia + ';');
  css.push('  --texto-' + kebab(k) + '-espaciado: ' + e.espaciado + 'px;');
}

css.push('');
css.push('  /* --- espaciado --- */');
for (const [k, v] of Object.entries(t.espaciado)) css.push('  --e' + k + ': ' + v + 'px;');

css.push('');
css.push('  /* --- radio --- */');
for (const [k, v] of Object.entries(t.radio)) css.push('  --radio-' + kebab(k) + ': ' + v + 'px;');

css.push('');
css.push('  /* --- sombra --- */');
for (const [k, v] of Object.entries(t.sombra)) css.push('  --sombra-' + kebab(k) + ': ' + v.valor + ';');

css.push('');
css.push('  /* --- movimiento --- */');
for (const [k, v] of Object.entries(t.movimiento)) css.push('  --ms-' + kebab(k) + ': ' + v.valor + 'ms;');

css.push('');
css.push('  /* --- capas --- */');
for (const [k, v] of Object.entries(t.capa)) css.push('  --z-' + kebab(k) + ': ' + v + ';');

css.push('}');
escribir('web/assets/css/tokens.css', css.join('\n') + '\n');

/* ----------------------------------------------------------------- Dart */

const dart = [];
dart.push('// Generado por tools/generar-tokens.mjs desde brand/tokens.json. No editar a mano.');
dart.push('');
dart.push("import 'package:flutter/material.dart';");
dart.push('');
dart.push('/// Paleta de Habita. Misma fuente que los tokens CSS del panel web,');
dart.push('/// para que la app y el panel no se desincronicen nunca.');
dart.push('abstract final class HabitaColores {');
for (const [grupo, valores] of Object.entries(t.color)) {
  if (grupo === 'sombra') continue;
  for (const [clave, def] of Object.entries(valores)) {
    const nombre = camel(grupo) + clave[0].toUpperCase() + clave.slice(1);
    dart.push('  /// ' + def.uso);
    dart.push('  static const Color ' + nombre + ' = Color(' + hexDart(def.valor) + ');');
  }
}
const aliasDart = {
  fondo: 'neutro50', superficie: 'neutro0', superficieSuave: 'primario100',
  superficieAlterna: 'neutro100', borde: 'neutro200', bordeFuerte: 'neutro300',
  bordeMarca: 'primario200', texto: 'neutro900', textoSuave: 'neutro500',
  textoMedio: 'neutro700', textoTitulo: 'azul700', textoInvertido: 'neutro0',
  marca: 'primario500', marcaHover: 'primario600', marcaActivo: 'primario700',
  lateral: 'azul900',
};
dart.push('');
dart.push('  // Alias semanticos');
for (const [k, v] of Object.entries(aliasDart)) dart.push('  static const Color ' + k + ' = ' + v + ';');
dart.push('');
dart.push('  /// Degrade del isotipo. Solo para marca: splash, encabezado, tarjeta destacada.');
dart.push('  static const LinearGradient degradeMarca = LinearGradient(');
dart.push('    begin: Alignment.centerLeft,');
dart.push('    end: Alignment.centerRight,');
dart.push('    colors: [marcaDegradeInicio, marcaDegradeMedio, marcaDegradeFin],');
dart.push('    stops: [0.0, 0.42, 1.0],');
dart.push('  );');
dart.push('}');
dart.push('');
dart.push('/// Escala tipografica. `cifrasTabulares` da ancho fijo a los digitos: sin eso');
dart.push('/// los montos no alinean en vertical y las listas de plata se ven amateur.');
dart.push('abstract final class HabitaTipografia {');
dart.push("  static const String familiaTitulos = 'Sora';");
dart.push("  static const String familiaTexto = 'Archivo';");
dart.push('  static const List<FontFeature> cifrasTabulares = [FontFeature.tabularFigures()];');
dart.push('');
for (const [k, e] of Object.entries(t.tipografia.escala)) {
  const familia = e.familia === 'titulos' ? 'familiaTitulos' : 'familiaTexto';
  dart.push('  static const TextStyle ' + camel(k) + ' = TextStyle(');
  dart.push('    fontFamily: ' + familia + ',');
  dart.push('    fontSize: ' + e.tamano + ',');
  dart.push('    height: ' + e.alto + ',');
  dart.push('    fontWeight: FontWeight.w' + e.peso + ',');
  dart.push('    letterSpacing: ' + e.espaciado + ',');
  if (e.tabular) dart.push('    fontFeatures: cifrasTabulares,');
  dart.push('  );');
}
dart.push('}');
dart.push('');
dart.push('abstract final class HabitaEspaciado {');
for (const [k, v] of Object.entries(t.espaciado)) dart.push('  static const double e' + k + ' = ' + v + ';');
dart.push('}');
dart.push('');
dart.push('abstract final class HabitaRadio {');
for (const [k, v] of Object.entries(t.radio)) dart.push('  static const double ' + camel(k) + ' = ' + v + ';');
dart.push('}');
dart.push('');
dart.push('abstract final class HabitaMovimiento {');
for (const [k, v] of Object.entries(t.movimiento)) {
  dart.push('  static const Duration ' + camel(k) + ' = Duration(milliseconds: ' + v.valor + ');');
}
dart.push('}');
escribir('mobile/lib/nucleo/tema/tokens.dart', dart.join('\n') + '\n');

console.log('Tokens generados desde brand/tokens.json');
