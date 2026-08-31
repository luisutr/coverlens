# Automatización de subidas a Google Play (EAS Submit)

Este documento explica cómo configurar tu proyecto de CoverLens para que las actualizaciones se envíen automáticamente a Google Play Store desde la terminal, sin tener que entrar a la web de Play Console y subir el archivo `.aab` a mano.

## Requisitos previos

1. Haber subido **al menos una primera versión** de la app a Google Play de forma manual (ya realizado).
2. Tener acceso a la [Google Play Console](https://play.google.com/console).
3. Tener acceso a [Google Cloud Console](https://console.cloud.google.com).

## Paso 1: Crear la clave de servicio (Service Account Key) en Google Cloud

Expo necesita un archivo `.json` que actúa como "llave" para subir cosas en tu nombre.

1. Ve a [Google Cloud Console](https://console.cloud.google.com).
2. Asegúrate de estar en el proyecto correcto (suele llamarse "Google Play Console Developer" o similar).
3. Ve a **IAM y administración > Cuentas de servicio** (Service Accounts).
4. Haz clic en **+ CREAR CUENTA DE SERVICIO** (Create Service Account).
5. Ponle un nombre identificativo, por ejemplo: `expo-eas-submit`. Haz clic en **Crear y Continuar**.
6. En el rol, selecciona **Cuenta de servicio > Usuario de cuenta de servicio** (Service Account User). Haz clic en **Continuar** y luego en **Listo**.
7. En la lista, haz clic sobre la cuenta que acabas de crear, ve a la pestaña **Claves** (Keys), haz clic en **Añadir clave > Crear clave nueva**.
8. Selecciona formato **JSON** y dale a Crear. **Se descargará un archivo `.json` a tu ordenador. Guárdalo bien y NO lo subas a GitHub.**

## Paso 1.5: Habilitar la API de Google Play en Google Cloud
Para que Google deje que la cuenta de servicio hable con Google Play, tienes que activar la API correspondiente en ese mismo proyecto de la nube:
1. Entra en este enlace: [Habilitar Google Play Android Developer API](https://console.developers.google.com/apis/api/androidpublisher.googleapis.com/overview) (o búscalo en la barra superior de Google Cloud).
2. Asegúrate de estar en tu proyecto y haz clic en el botón azul **HABILITAR** (Enable).

## Paso 2: Dar permisos a la clave en Google Play Console

Esa llave existe, pero ahora Google Play tiene que aceptarla. En las versiones modernas de Play Console, la cuenta de servicio se añade como si fuera un trabajador más.

1. Ve a [Google Play Console](https://play.google.com/console).
2. En el menú izquierdo, busca la sección **Usuarios y permisos** (Users and permissions).
3. Haz clic en el botón azul **Invitar a nuevos usuarios** (Invite new users).
4. En el campo de correo electrónico, pega el email exacto de la cuenta de servicio que creaste en el paso 1 (terminará en `@...iam.gserviceaccount.com`).
5. En la pestaña de **Permisos de la aplicación**, selecciona `CoverLens`.
6. En la pestaña de **Permisos de la cuenta**, marca la casilla de **Administrador (todos los permisos)** para asegurar que Expo pueda gestionar canales de pruebas y lanzar a producción sin problemas.
7. Haz clic en **Invitar usuario** (abajo a la derecha).

## Paso 3: Configurar EAS en tu terminal

Una vez tengas el archivo `.json`, vamos a vincularlo a tu proyecto de Expo:

1. Abre tu terminal en la carpeta del proyecto.
2. Genera una build de producción si no la tienes ya:
   ```bash
   eas build --platform android --profile production
   ```
3. Lanza el comando de subida:
   ```bash
   eas submit -p android
   ```
4. El asistente de la terminal te preguntará:
   - ¿Qué build quieres subir? (Selecciona la última que has compilado).
   - ¿Tienes un archivo JSON de Google Service Account? Responde que **SÍ**.
   - Te pedirá la ruta hacia el archivo `.json` que descargaste en el Paso 1. Se lo indicas (arrastrando el archivo a la terminal funciona).

¡Y listo! Expo guardará esa llave en tu cuenta de `expo.dev` de forma segura. 

## Workflow para el futuro (El día a día)

Para las siguientes actualizaciones, ya no tendrás que hacer nada de esto. Cuando quieras mandar código nuevo a tus testers, simplemente ejecutarás:

```bash
eas build --platform android --profile production --auto-submit
```

Ese comando lo hará todo: compila la app y, cuando termina, la inyecta automáticamente en Google Play Console.
