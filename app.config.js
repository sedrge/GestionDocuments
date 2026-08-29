module.exports = {
  expo: {
    name: "SenMoto",
    slug: "docvault",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/SenMoto.png",
    scheme: "docvault",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      icon: "./assets/images/SenMoto.png",
      bundleIdentifier: "com.senmoto.app",
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#121212",
        foregroundImage: "./assets/images/SenMoto.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.senmoto.app",
      // Compte EAS basculé sur @sedrges (quota @sedrge épuisé, voir mémoire) :
      // "appVersionSource" repassé à "local" (le nouveau projet ne connaît
      // pas l'historique de versionCode). Play Store exige un versionCode
      // strictement supérieur au dernier publié (16) — à incrémenter à la
      // main à chaque nouveau build tant qu'on est sur ce compte.
      versionCode: 17,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "CAMERA"],
    },
    web: {
      output: "static",
      favicon: "./assets/images/SenMoto.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/SenMoto.png",
          imageWidth: 250,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#121212",
          },
        },
      ],
      "expo-secure-store",
      "expo-web-browser",
      "expo-sqlite",
      [
        "expo-notifications",
        {
          color: "#5856D6",
        },
      ],
      "expo-font",
      "expo-image",
      "expo-sharing",
      "expo-status-bar",
      "expo-video",
      [
        "expo-camera",
        {
          cameraPermission:
            "Accès à la caméra pour scanner les QR codes des motos.",
          microphonePermission:
            "Accès au micro pour filmer des vidéos avec le son.",
        },
      ],
      [
        "expo-audio",
        {
          microphonePermission:
            "Accès au micro pour envoyer des messages vocaux dans le chat.",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "SenMoto utilise votre position pour localiser votre boutique sur la carte.",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    // EAS Update (mises à jour OTA du JS seul, sans repasser par le Play
    // Store). "fingerprint" calcule la compatibilité depuis le code natif
    // réel plutôt que depuis `version` (figé à 1.0.0, jamais bumpé) : un
    // build qui ajoute du code natif (comme expo-in-app-updates) n'est
    // jamais confondu avec un ancien binaire.
    runtimeVersion: {
      policy: "fingerprint",
    },
    updates: {
      url: "https://u.expo.dev/d989071f-86f4-40b9-a604-cfd2c516ea8d",
    },
    extra: {
      // Backend Laravel hébergé sur o2switch.
      laravelApiUrl: "https://senmoto-api.seninovagroup.com/api",
      router: {},
      eas: {
        projectId: "d989071f-86f4-40b9-a604-cfd2c516ea8d",
      },
    },
  },
};
