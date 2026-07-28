# LottoMind Native

Capacitor wrapper for the existing `lotto mind refined` static app.

The generated `www` folder is a store-sized staging copy. PNGs are resized and
compressed there without modifying the website source.

## Configuration

1. Add the RevenueCat Apple and Google public SDK keys to
   `../lotto mind refined/revenuecat-native-config.json`.
2. Configure matching apps, products, the `pro` entitlement, and a current
   offering in RevenueCat, App Store Connect, and Google Play Console.
3. Run `npm run sync` after changing web files or native dependencies.

The sync lifecycle also normalizes Capacitor's generated Swift package paths
when it runs on Windows so the checked project remains readable by Xcode on
macOS.

## Commands

```powershell
npm.cmd run sync
npm.cmd run open:android
npm.cmd run open:ios
```

Android Studio can be opened on Windows. The iOS project is generated here,
but signing and App Store builds require Xcode on macOS.
