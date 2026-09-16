import 'package:flutter_test/flutter_test.dart';
import 'package:habita/presentacion/widgets.dart';

void main() {
  test('Expensas y saldos conservan centavos y signo al mostrarse', () {
    expect(pesos(123456), r'$ 1.234,56');
    expect(pesos(1), r'$ 0,01');
    expect(pesos(0), r'$ 0,00');
    expect(pesos(-150), r'-$ 1,50');
  });
}
