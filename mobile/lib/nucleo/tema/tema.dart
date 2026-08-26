import 'package:flutter/material.dart';

import 'tokens.dart';

abstract final class HabitaTema {
  static ThemeData get claro {
    final esquema = ColorScheme.fromSeed(
      seedColor: HabitaColores.marca,
      primary: HabitaColores.marcaActivo,
      secondary: HabitaColores.marcaDegradeFin,
      surface: HabitaColores.superficie,
      error: HabitaColores.estadoError,
      brightness: Brightness.light,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: esquema,
      scaffoldBackgroundColor: HabitaColores.fondo,
      fontFamily: HabitaTipografia.familiaTexto,
      textTheme:
          const TextTheme(
            headlineLarge: HabitaTipografia.titulo1,
            headlineMedium: HabitaTipografia.titulo2,
            titleLarge: HabitaTipografia.titulo3,
            bodyLarge: HabitaTipografia.cuerpoGrande,
            bodyMedium: HabitaTipografia.cuerpo,
            bodySmall: HabitaTipografia.cuerpoChico,
            labelLarge: HabitaTipografia.etiqueta,
          ).apply(
            bodyColor: HabitaColores.texto,
            displayColor: HabitaColores.textoTitulo,
          ),
      appBarTheme: const AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: HabitaColores.superficie,
        foregroundColor: HabitaColores.textoTitulo,
        titleTextStyle: HabitaTipografia.titulo3,
      ),
      cardTheme: CardThemeData(
        margin: EdgeInsets.zero,
        elevation: 0,
        color: HabitaColores.superficie,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(HabitaRadio.medio),
          side: const BorderSide(color: HabitaColores.borde),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: HabitaColores.superficie,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(HabitaRadio.chico),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(HabitaRadio.chico),
          borderSide: const BorderSide(color: HabitaColores.bordeFuerte),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 13,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(HabitaRadio.chico),
          ),
          textStyle: HabitaTipografia.etiqueta,
        ),
      ),
      navigationBarTheme: const NavigationBarThemeData(
        height: 66,
        backgroundColor: HabitaColores.superficie,
        indicatorColor: HabitaColores.primario100,
        labelTextStyle: WidgetStatePropertyAll(HabitaTipografia.micro),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
