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
      bundleIdentifier: "com.anonymous.docvault",
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#121212",
        foregroundImage: "./assets/images/SenMoto.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.anonymous.docvault",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
      ],
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
      [
        "expo-camera",
        {
          "cameraPermission": "Accès à la caméra pour scanner les QR codes des motos."
        }
      ],
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "SenMoto utilise votre position pour localiser votre boutique sur la carte."
        }
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      supabaseUrl: "https://cxjqzbyhilrimjbnqjjf.supabase.co",
      supabaseAnonKey: "sb_publishable_IrC8XntZO7hRlCsx8ldzQQ_36r5YMc-",
      router: {},
      eas: {
        projectId: "9cf8bec5-40f6-42c8-ad79-6d2e50cba58d",
      },
    },
  },
};
