# Qadre

App para llevar las cuentas del mes. La hice porque quería saber cuánta plata me queda de verdad para el resto del mes y en qué se me está yendo, con mis propios números y no con reglas genéricas.

En vivo: https://qadre-app.vercel.app (la app está en `/app/`; "Ver con datos de ejemplo" la abre con tres meses de movimientos).

![Resumen en el computador](docs/captura-resumen.png)

| Resumen en el celular | Registrar un gasto | Modo oscuro |
| --- | --- | --- |
| ![](docs/captura-movil-resumen.png) | ![](docs/captura-movil-nuevo.png) | ![](docs/captura-movil-oscuro.png) |

## Lo que hace

- Resumen del mes: cuánto te queda, cuánto puedes gastar por día y una barra que compara lo gastado con los días que han pasado.
- Registrar un gasto o un ingreso en pocos toques, con categoría, fecha y cuenta (efectivo, Bancolombia, Nequi…).
- Presupuestos por categoría que avisan antes de que te pases, y metas de ahorro que dicen cuánto apartar al mes.
- Importar el extracto del banco en CSV. Reconoce las columnas, sugiere la categoría según el comercio y recuerda las correcciones.
- Recomendaciones según tu historial: gastos hormiga, suscripciones, categorías que van por encima de tu promedio.
- Ocultar montos para abrirla en público, tema claro y oscuro, y respaldo en JSON.

Para proyectar el fin de mes no uso una regla de tres: el arriendo que pagaste el día 2 no se multiplica por 31. Los pagos fijos cuentan una vez y solo lo variable se proyecta.

## Cuentas

Con Supabase cada persona crea su cuenta y ve sus datos en el celular y en el computador. Cada fila de la base tiene el `user_id` de su dueño y las políticas (RLS) solo dejan leer y cambiar lo propio. Después de 5 contraseñas equivocadas el correo queda bloqueado un rato.

Sin cuenta también funciona: los datos se quedan en el navegador.

Para conectarla:

1. Crea un proyecto en [supabase.com](https://supabase.com) y corre los archivos de `supabase/migrations/` en el SQL Editor.
2. En Authentication → URL Configuration pon la dirección de la app como Site URL y en Redirect URLs.
3. Copia `.env.example` como `.env.local` (o crea las variables en Vercel) con la URL y la llave anon.

## Con qué está hecha

React, TypeScript, Redux Toolkit con RTK Query, React Router y Vite. Las gráficas son SVG hechos a mano. La base de datos y las cuentas son de Supabase. Las pantallas no saben dónde se guardan los datos: todo pasa por `src/data/repository.ts`, que tiene una versión para el navegador y otra para Supabase.

La lógica (totales, proyección, recomendaciones, lectura del CSV) está en `src/domain/` y tiene pruebas con Vitest.

## Correrla

```bash
npm install
npm run dev
npm test
npm run build
```

En Windows con PowerShell usa `npm.cmd` si `npm` da error.

`portable/index.html` se abre con doble clic, sin instalar nada (`npm run build:portable` lo regenera).

Licencia MIT.
