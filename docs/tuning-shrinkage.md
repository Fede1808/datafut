# Tuning del shrinkage

Validacion temporal desde **2022** · vida media **1800 dias**.
Se entrena solo con el pasado de cada temporada y se predice la siguiente.
Mas bajo es mejor en las dos metricas.

La columna `Estudiantes (RC)` es su parametro de ataque entrenando con
TODO el historico: es el caso testigo del sobreajuste (16 partidos jugados).

| Shrinkage | Log loss | Brier | Estudiantes (RC) | Ataque mas extremo |
|---:|---:|---:|---:|---|
| 0 | 1.0664 | 0.6445 | -1.163 | Estudiantes (RC) -1.163 |
| 1 | 1.0662 | 0.6444 | -0.867 | Estudiantes (RC) -0.867 |
| 2 | 1.0660 | 0.6443 | -0.715 | Estudiantes (RC) -0.715 |
| 5 | 1.0656 | 0.6440 | -0.490 | Estudiantes (RC) -0.490 |
| 10 | 1.0650 | 0.6436 | -0.334 | Estudiantes (RC) -0.334 |
| 15 | 1.0647 | 0.6434 | -0.257 | Estudiantes (RC) -0.257 |
| 20 | 1.0645 | 0.6432 | -0.209 | Estudiantes (RC) -0.209 |
| 25 | 1.0644 | 0.6432 | -0.177 | Sarmiento (J) -0.185 |
| **30** | **1.0644** | 0.6431 | -0.153 | Sarmiento (J) -0.178 |
| 40 | 1.0645 | 0.6432 | -0.121 | Sarmiento (J) -0.165 |
| 50 | 1.0648 | 0.6434 | -0.101 | Sarmiento (J) -0.153 |
| 100 | 1.0666 | 0.6446 | -0.054 | Sarmiento (J) -0.114 |
| 200 | 1.0697 | 0.6468 | -0.028 | Sarmiento (J) -0.075 |
| 500 | 1.0741 | 0.6498 | -0.012 | Sarmiento (J) -0.037 |

## Conclusion

Mejor log loss fuera de muestra: **shrinkage = 30** (1.0644).
Sin shrinkage el log loss es 1.0664, o sea una diferencia de **+0.0020**.

Con ese valor el ataque de Estudiantes (RC) pasa de -1.163 a -0.153.

El default del modelo es **25**. Ojo con leer el minimo exacto de esta tabla como si fuera preciso: el fondo de la U es una meseta plana donde las diferencias son de 0.0001, o sea ruido. Cualquier valor de esa zona sirve igual; se elige uno del medio y no el minimo exacto, justamente para no sobreajustar la eleccion del parametro.
