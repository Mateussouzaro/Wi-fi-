#!/usr/bin/env bash
# Builds android-build/RotaSul.apk from dist/index.html without Gradle:
# aapt2 (resources) -> javac -> dx (dex) -> zip -> zipalign -> apksigner.
# Needs: apt packages android-sdk-platform-23 android-sdk-build-tools apksigner zipalign,
# a JDK, and android-build/tools/dx.jar (com.jakewharton.android.repackaged:dalvik-dx:16.0.1).
set -euo pipefail
cd "$(dirname "$0")"
SDK=/usr/lib/android-sdk
JAR=$SDK/platforms/android-23/android.jar
OUT=android-build
rm -rf "$OUT/obj" "$OUT/apk" "$OUT/gen"
mkdir -p "$OUT/obj" "$OUT/apk/assets" "$OUT/gen"

npx vite build >/dev/null
cp dist/index.html "$OUT/apk/assets/index.html"

aapt2 compile --dir android/res -o "$OUT/res.zip"
aapt2 link -o "$OUT/base.apk" -I "$JAR" --manifest android/AndroidManifest.xml \
  --java "$OUT/gen" -A "$OUT/apk/assets" "$OUT/res.zip" --auto-add-overlay
javac -nowarn --release 8 -cp "$JAR" -d "$OUT/obj" $(find android/src "$OUT/gen" -name '*.java') 2>&1 | grep -v "Picked up" || true
java -cp "$OUT/tools/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=23 --output="$OUT/classes.dex" "$OUT/obj" 2>&1 | grep -v "Picked up" || true
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT" && zip -q -j unsigned.apk classes.dex)
zipalign -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
if [ ! -f "$OUT/rotasul.keystore" ]; then
  keytool -genkeypair -keystore "$OUT/rotasul.keystore" -alias rotasul -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass rotasul123 -keypass rotasul123 -dname "CN=Rota Sul, O=Rota Sul, C=BR" 2>&1 | grep -v "Picked up" || true
fi
apksigner sign --ks "$OUT/rotasul.keystore" --ks-pass pass:rotasul123 --key-pass pass:rotasul123 --out "$OUT/RotaSul.apk" "$OUT/aligned.apk"
apksigner verify "$OUT/RotaSul.apk" && ls -la "$OUT/RotaSul.apk"
