# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Documentación del proyecto (CoverLens)

- **Portadas y fuentes:** [docs/PORTADAS_Y_FUENTES.md](docs/PORTADAS_Y_FUENTES.md) — orden de resolución (GameplayStores, SteamGridDB, IGDB, ScreenScraper), uso del buscador JSON de la tienda, metadatos y archivos clave.
- **Texto en la app:** Ajustes → «Documentación: portadas y fuentes» (sale de `constants/documentation/portadasYFuentesDoc.ts`; si cambias la lógica, actualiza ese módulo y el Markdown).
- **Flujo Android + iOS:** [docs/WORKFLOW_ANDROID_IOS.md](docs/WORKFLOW_ANDROID_IOS.md) — estructura de ramas, merges y setup recomendado para desarrollo paralelo sin conflictos.
- **Registro de cambios:** [CHANGELOG.md](CHANGELOG.md) — obligatorio actualizarlo en cada PR/commit funcional.
- **Prelanzamiento stores:** [docs/PRELANZAMIENTO_STORES_CHECKLIST.md](docs/PRELANZAMIENTO_STORES_CHECKLIST.md) — checklist legal, privacidad y calidad antes de enviar a App Store/Google Play.
- **Fuentes y atribuciones:** [docs/FUENTES_Y_ATRIBUCIONES.md](docs/FUENTES_Y_ATRIBUCIONES.md) — no afiliación, proveedores externos y riesgos/licencias.
- **Solicitudes de permisos:** [docs/PLANTILLAS_SOLICITUD_PERMISOS.md](docs/PLANTILLAS_SOLICITUD_PERMISOS.md) — plantillas de email para GameplayStores, SteamGridDB, ScreenScraper y GameUPC.
- **Seguimiento de permisos:** [docs/SEGUIMIENTO_PERMISOS_PROVEEDORES.md](docs/SEGUIMIENTO_PERMISOS_PROVEEDORES.md) — tablero de estado para decidir qué fuentes se pueden activar en release.
- **Política de privacidad (ES):** [docs/PRIVACY_POLICY_ES.md](docs/PRIVACY_POLICY_ES.md) — base para publicar URL de privacidad en App Store Connect y Google Play Console.

## Licencia

- Código: GNU GPL v3.0 (`LICENSE`).
- Aviso legal del proyecto: `NOTICE`.
- Proveedores externos: revisar términos y permisos antes de habilitarlos en release público.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
