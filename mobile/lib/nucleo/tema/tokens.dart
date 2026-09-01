// Generado por tools/generar-tokens.mjs desde brand/tokens.json. No editar a mano.

import 'package:flutter/material.dart';

/// Paleta de Habita. Misma fuente que los tokens CSS del panel web,
/// para que la app y el panel no se desincronicen nunca.
abstract final class HabitaColores {
  /// Isotipo: arranque del degrade
  static const Color marcaDegradeInicio = Color(0xFF0450D2);
  /// Isotipo: medio del degrade
  static const Color marcaDegradeMedio = Color(0xFF0189E8);
  /// Isotipo: cierre del degrade
  static const Color marcaDegradeFin = Color(0xFF05C8A6);
  /// Fondos de seccion, tarjetas, hover suave
  static const Color primario100 = Color(0xFFE8F3FC);
  /// Divisores suaves, bordes de tarjeta activa
  static const Color primario200 = Color(0xFFC7E1F5);
  /// Bordes de foco, estados deshabilitados sobre celeste
  static const Color primario300 = Color(0xFF8DC3EE);
  /// Color de marca: botones, elementos activos, iconos
  static const Color primario500 = Color(0xFF3E9BE4);
  /// Hover de boton primario
  static const Color primario600 = Color(0xFF2F82C6);
  /// Presionado de boton primario
  static const Color primario700 = Color(0xFF22689F);
  /// Iconos sobre fondo claro, subtitulos
  static const Color azul500 = Color(0xFF1F5484);
  /// Titulos, encabezado del panel, texto sobre blanco
  static const Color azul700 = Color(0xFF14395E);
  /// Barra lateral del panel, fondos oscuros
  static const Color azul900 = Color(0xFF0C2440);
  /// Superficie principal
  static const Color neutro0 = Color(0xFFFFFFFF);
  /// Fondo de aplicacion
  static const Color neutro50 = Color(0xFFF7FAFC);
  /// Filas alternas de tabla, fondos sutiles
  static const Color neutro100 = Color(0xFFEEF3F7);
  /// Bordes y separadores
  static const Color neutro200 = Color(0xFFDCE5EC);
  /// Bordes de campo de formulario
  static const Color neutro300 = Color(0xFFC3D0DA);
  /// Texto secundario
  static const Color neutro500 = Color(0xFF5C6D7C);
  /// Texto de enfasis medio
  static const Color neutro700 = Color(0xFF2C3E4D);
  /// Texto principal
  static const Color neutro900 = Color(0xFF16232E);
  /// Chip 'Al dia' / 'Resuelto'
  static const Color estadoExitoFondo = Color(0xFFE3F5ED);
  /// Borde del chip de exito
  static const Color estadoExitoBorde = Color(0xFFB6E4D0);
  /// Al dia, pagado, resuelto, acceso permitido
  static const Color estadoExito = Color(0xFF1F9D6B);
  /// Texto sobre fondo de exito
  static const Color estadoExitoTexto = Color(0xFF146B48);
  /// Chip 'Pendiente' / 'En progreso'
  static const Color estadoAvisoFondo = Color(0xFFFCF2E0);
  /// Borde del chip de aviso
  static const Color estadoAvisoBorde = Color(0xFFF2DCB0);
  /// Pendiente, en progreso, por vencer
  static const Color estadoAviso = Color(0xFFE0A030);
  /// Texto sobre fondo de aviso
  static const Color estadoAvisoTexto = Color(0xFF8A5E11);
  /// Chip 'Vencido' / 'Critico'
  static const Color estadoErrorFondo = Color(0xFFFBE9E6);
  /// Borde del chip de error
  static const Color estadoErrorBorde = Color(0xFFF2C4BD);
  /// Vencido, rechazado, partida critica
  static const Color estadoError = Color(0xFFD8503F);
  /// Texto sobre fondo de error
  static const Color estadoErrorTexto = Color(0xFF9B3123);
  /// Chip informativo
  static const Color estadoInfoFondo = Color(0xFFE8F3FC);
  /// Informativo, en revision
  static const Color estadoInfo = Color(0xFF3E9BE4);
  /// Texto sobre fondo informativo
  static const Color estadoInfoTexto = Color(0xFF14395E);
  /// Serie principal (recaudado)
  static const Color graficoSerie1 = Color(0xFF3E9BE4);
  /// Serie secundaria (pendiente)
  static const Color graficoSerie2 = Color(0xFF14395E);
  /// Tercera serie
  static const Color graficoSerie3 = Color(0xFF1F9D6B);
  /// Cuarta serie
  static const Color graficoSerie4 = Color(0xFFE0A030);
  /// Quinta serie
  static const Color graficoSerie5 = Color(0xFFD8503F);
  /// Sexta serie / relleno suave
  static const Color graficoSerie6 = Color(0xFF8DC3EE);
  /// Lineas de grilla y ejes
  static const Color graficoGrilla = Color(0xFFDCE5EC);

  // Alias semanticos
  static const Color fondo = neutro50;
  static const Color superficie = neutro0;
  static const Color superficieSuave = primario100;
  static const Color superficieAlterna = neutro100;
  static const Color borde = neutro200;
  static const Color bordeFuerte = neutro300;
  static const Color bordeMarca = primario200;
  static const Color texto = neutro900;
  static const Color textoSuave = neutro500;
  static const Color textoMedio = neutro700;
  static const Color textoTitulo = azul700;
  static const Color textoInvertido = neutro0;
  static const Color marca = primario500;
  static const Color marcaHover = primario600;
  static const Color marcaActivo = primario700;
  static const Color lateral = azul900;

  /// Degrade del isotipo. Solo para marca: splash, encabezado, tarjeta destacada.
  static const LinearGradient degradeMarca = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [marcaDegradeInicio, marcaDegradeMedio, marcaDegradeFin],
    stops: [0.0, 0.42, 1.0],
  );
}

/// Escala tipografica. `cifrasTabulares` da ancho fijo a los digitos: sin eso
/// los montos no alinean en vertical y las listas de plata se ven amateur.
abstract final class HabitaTipografia {
  static const String familiaTitulos = 'Sora';
  static const String familiaTexto = 'Archivo';
  static const List<FontFeature> cifrasTabulares = [FontFeature.tabularFigures()];

  static const TextStyle display = TextStyle(
    fontFamily: familiaTitulos,
    fontSize: 40,
    height: 1.1,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.8,
  );
  static const TextStyle titulo1 = TextStyle(
    fontFamily: familiaTitulos,
    fontSize: 28,
    height: 1.2,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.4,
  );
  static const TextStyle titulo2 = TextStyle(
    fontFamily: familiaTitulos,
    fontSize: 22,
    height: 1.25,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
  );
  static const TextStyle titulo3 = TextStyle(
    fontFamily: familiaTitulos,
    fontSize: 18,
    height: 1.3,
    fontWeight: FontWeight.w600,
    letterSpacing: 0,
  );
  static const TextStyle cifra = TextStyle(
    fontFamily: familiaTitulos,
    fontSize: 30,
    height: 1.15,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.5,
    fontFeatures: cifrasTabulares,
  );
  static const TextStyle cifraChica = TextStyle(
    fontFamily: familiaTitulos,
    fontSize: 20,
    height: 1.2,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
    fontFeatures: cifrasTabulares,
  );
  static const TextStyle cuerpoGrande = TextStyle(
    fontFamily: familiaTexto,
    fontSize: 16,
    height: 1.55,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
  );
  static const TextStyle cuerpo = TextStyle(
    fontFamily: familiaTexto,
    fontSize: 14,
    height: 1.5,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
  );
  static const TextStyle cuerpoChico = TextStyle(
    fontFamily: familiaTexto,
    fontSize: 13,
    height: 1.45,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
  );
  static const TextStyle etiqueta = TextStyle(
    fontFamily: familiaTexto,
    fontSize: 12,
    height: 1.35,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.4,
  );
  static const TextStyle micro = TextStyle(
    fontFamily: familiaTexto,
    fontSize: 11,
    height: 1.3,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.3,
  );
}

abstract final class HabitaEspaciado {
  static const double e0 = 0;
  static const double e1 = 4;
  static const double e2 = 8;
  static const double e3 = 12;
  static const double e4 = 16;
  static const double e5 = 20;
  static const double e6 = 24;
  static const double e8 = 32;
  static const double e10 = 40;
  static const double e12 = 48;
  static const double e16 = 64;
}

abstract final class HabitaRadio {
  static const double chico = 8;
  static const double medio = 12;
  static const double grande = 16;
  static const double xl = 22;
  static const double pastilla = 999;
}

abstract final class HabitaMovimiento {
  static const Duration rapido = Duration(milliseconds: 120);
  static const Duration normal = Duration(milliseconds: 220);
  static const Duration lento = Duration(milliseconds: 380);
}
