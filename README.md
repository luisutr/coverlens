# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Documentación del proyecto (CoverLens)

- **Guía de usuario:** [docs/GUIA_USUARIO_COVERLENS.md](docs/GUIA_USUARIO_COVERLENS.md) — manual completo (colección, escáner, ficha, ajustes, terceros). En la app: **Ajustes → Cómo usar CoverLens** (`constants/documentation/userGuideDoc.ts`).
- **Portadas y fuentes:** [docs/PORTADAS_Y_FUENTES.md](docs/PORTADAS_Y_FUENTES.md) — CoverLens integrado como fuente principal; terceros opcionales (ScreenScraper, SteamGridDB, IGDB, GameUPC, PriceCharting, eBay). GameplayStores desactivado.
- **Privacidad y cumplimiento:** [docs/PRIVACY_POLICY_ES.md](docs/PRIVACY_POLICY_ES.md) (política pública), [docs/privacidad/index.html](docs/privacidad/index.html) (HTML para VPS), [docs/API_TERMS_COMPLIANCE.md](docs/API_TERMS_COMPLIANCE.md) (registro legal APIs), [docs/FUENTES_TERCEROS_DECISION.md](docs/FUENTES_TERCEROS_DECISION.md) (decisión de fuentes terceros), [PRIVACY_APP_STORE_NOTES.md](PRIVACY_APP_STORE_NOTES.md) (notas para tiendas). Regenerar HTML: `node scripts/build-privacy-html.mjs`.
- **Texto en la app:** Ajustes → «Cómo usar CoverLens» (`userGuideDoc.ts`) y «Documentación: portadas y fuentes» (`portadasYFuentesDoc.ts`); si cambias la lógica, actualiza el módulo y el Markdown correspondiente.
- **Flujo Android + iOS:** [docs/WORKFLOW_ANDROID_IOS.md](docs/WORKFLOW_ANDROID_IOS.md) — estructura de ramas, merges y setup recomendado para desarrollo paralelo sin conflictos.

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
