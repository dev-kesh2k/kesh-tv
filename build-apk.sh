#!/usr/bin/env bash
# Gerador de APK do Kesh TV — três versões do app Android, todas para celular e Android TV:
#
#   webview  o site dentro de um app (mais leve; tudo que muda no site já aparece no app)
#   kotlin   app nativo em Kotlin + Jetpack Compose, player Media3 (ExoPlayer)
#   flutter  app em Flutter (Dart), player video_player
#
#   ./build-apk.sh                         pergunta qual gerar
#   ./build-apk.sh kotlin [versão] [endereço]
#   ./build-apk.sh todos 1.2.0 https://meu-servidor/kesh-tv/
#
# Só precisa de Docker. Os APKs saem em dist/. Na primeira vez cria a chave de assinatura em
# android/keystore/ (fora do git) — guarde uma cópia: sem ela as próximas versões não instalam por cima.
# Para usar uma chave existente: KESH_KEYSTORE=/caminho KESH_KEYSTORE_PASSWORD=...
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"

KIND="${1:-}"
if [ -z "$KIND" ]; then
  echo "Qual APK gerar?"
  echo "  1) WebView  — o site dentro de um app (mais leve)"
  echo "  2) Kotlin   — app nativo (Jetpack Compose + Media3)"
  echo "  3) Flutter  — app em Flutter"
  echo "  4) Todos"
  read -rp "Opção [1-4]: " n
  case "$n" in 1) KIND=webview ;; 2) KIND=kotlin ;; 3) KIND=flutter ;; 4) KIND=todos ;; *) echo "Opção inválida"; exit 1 ;; esac
fi
case "$KIND" in webview|kotlin|flutter|todos) ;; *) echo "Tipo inválido: $KIND (use webview, kotlin, flutter ou todos)"; exit 1 ;; esac

VERSION="${2:-$(date +%Y.%m.%d)}"
URL="${3:-https://central-apps-hub.com.br/kesh-tv/}"
CODE="$(date +%s | cut -c1-9)"   # versionCode sempre crescente
ANDROID_IMAGE=kesh-tv-android-builder
FLUTTER_IMAGE=ghcr.io/cirruslabs/flutter:3.24.5

# Chave de assinatura (a mesma nas três versões).
if [ -z "${KESH_KEYSTORE:-}" ]; then
  mkdir -p android/keystore
  if [ ! -f android/keystore/kesh-tv.jks ]; then
    PASS="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
    echo "Criando a chave de assinatura em android/keystore/ (guarde uma cópia!)"
    docker run --rm -v "$ROOT/android/keystore:/k" eclipse-temurin:17-jdk-jammy keytool -genkeypair -keystore /k/kesh-tv.jks \
      -alias kesh-tv -keyalg RSA -keysize 2048 -validity 36500 -storepass "$PASS" -keypass "$PASS" -dname "CN=Kesh TV" >/dev/null 2>&1
    printf 'KESH_KEYSTORE_PASSWORD=%s\n' "$PASS" > android/keystore/keystore.env
    chmod 600 android/keystore/kesh-tv.jks android/keystore/keystore.env
  fi
  # shellcheck disable=SC1091
  . android/keystore/keystore.env
  KESH_KEYSTORE="$ROOT/android/keystore/kesh-tv.jks"
fi
SIGN=(-v "$KESH_KEYSTORE:/keystore.jks:ro" -e KESH_KEYSTORE=/keystore.jks -e KESH_KEYSTORE_PASSWORD="$KESH_KEYSTORE_PASSWORD"
  -e KESH_KEY_ALIAS="${KESH_KEY_ALIAS:-kesh-tv}" -e KESH_KEY_PASSWORD="${KESH_KEY_PASSWORD:-$KESH_KEYSTORE_PASSWORD}")

mkdir -p dist
gradle_build() { # pasta, nome do APK
  docker image inspect "$ANDROID_IMAGE" >/dev/null 2>&1 || docker build -t "$ANDROID_IMAGE" android/docker
  docker run --rm -v "$ROOT/$1:/work" -v kesh-tv-gradle:/root/.gradle "${SIGN[@]}" "$ANDROID_IMAGE" \
    ./gradlew --no-daemon -q assembleRelease -PversionName="$VERSION" -PversionCode="$CODE" -PstartUrl="$URL"
  cp "$1/app/build/outputs/apk/release/app-release.apk" "dist/$2-$VERSION.apk"
}
flutter_build() {
  docker run --rm -v "$ROOT/flutter:/src" -w /src -v kesh-tv-pub:/root/.pub-cache -v kesh-tv-gradle:/root/.gradle "${SIGN[@]}" "$FLUTTER_IMAGE" \
    bash -c "flutter pub get >/dev/null && flutter build apk --release --build-name='$VERSION' --build-number='$CODE' --dart-define=KESH_SERVER='$URL'; s=\$?; chown -R $(id -u):$(id -g) /src; exit \$s"
  cp flutter/build/app/outputs/flutter-apk/app-release.apk "dist/kesh-tv-flutter-$VERSION.apk"
}

want() { [ "$KIND" = "$1" ] || [ "$KIND" = todos ]; }
if want webview; then gradle_build android kesh-tv; fi
if want kotlin; then gradle_build android-kotlin kesh-tv-kotlin; fi
if want flutter; then flutter_build; fi

echo "Pronto ($URL):"
ls -lh dist/*-"$VERSION".apk | awk '{print "  " $NF " (" $5 ")"}'
