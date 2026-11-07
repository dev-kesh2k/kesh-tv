#!/usr/bin/env bash
# Gerador do APK do Kesh TV (celular e Android TV).
#
#   android/build-apk.sh [versão] [endereço]
#   ex.: android/build-apk.sh 1.2.0 https://meu-servidor/kesh-tv/
#
# Compila dentro de um container com o Android SDK (só precisa de Docker). Na primeira vez cria a chave
# de assinatura em android/keystore/ (fora do git) — guarde uma cópia: sem ela as próximas versões não
# instalam por cima da anterior. Para usar uma chave existente: KESH_KEYSTORE=/caminho KESH_KEYSTORE_PASSWORD=...
set -euo pipefail
cd "$(dirname "$0")"
VERSION="${1:-$(date +%Y.%m.%d)}"
URL="${2:-https://central-apps-hub.com.br/kesh-tv/}"
CODE="$(date +%s | cut -c1-9)"   # versionCode sempre crescente
IMAGE=kesh-tv-android-builder

if [ -z "${KESH_KEYSTORE:-}" ]; then
  mkdir -p keystore
  if [ ! -f keystore/kesh-tv.jks ]; then
    PASS="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
    echo "Criando a chave de assinatura em android/keystore/ (guarde uma cópia!)"
    docker run --rm -v "$PWD/keystore:/k" eclipse-temurin:17-jdk-jammy keytool -genkeypair -keystore /k/kesh-tv.jks \
      -alias kesh-tv -keyalg RSA -keysize 2048 -validity 36500 -storepass "$PASS" -keypass "$PASS" -dname "CN=Kesh TV" >/dev/null 2>&1
    printf 'KESH_KEYSTORE_PASSWORD=%s\n' "$PASS" > keystore/keystore.env
    chmod 600 keystore/kesh-tv.jks keystore/keystore.env
  fi
  # shellcheck disable=SC1091
  . keystore/keystore.env
  KESH_KEYSTORE_IN=/work/keystore/kesh-tv.jks
else
  KESH_KEYSTORE_IN=/keystore.jks
fi

docker image inspect "$IMAGE" >/dev/null 2>&1 || docker build -t "$IMAGE" docker
docker run --rm -v "$PWD:/work" -v kesh-tv-gradle:/root/.gradle \
  ${KESH_KEYSTORE:+-v "$KESH_KEYSTORE:/keystore.jks:ro"} \
  -e KESH_KEYSTORE="$KESH_KEYSTORE_IN" -e KESH_KEYSTORE_PASSWORD="$KESH_KEYSTORE_PASSWORD" \
  -e KESH_KEY_ALIAS="${KESH_KEY_ALIAS:-kesh-tv}" -e KESH_KEY_PASSWORD="${KESH_KEY_PASSWORD:-$KESH_KEYSTORE_PASSWORD}" \
  "$IMAGE" ./gradlew --no-daemon -q assembleRelease -PversionName="$VERSION" -PversionCode="$CODE" -PstartUrl="$URL"

mkdir -p dist
cp app/build/outputs/apk/release/app-release.apk "dist/kesh-tv-$VERSION.apk"
echo "APK pronto: android/dist/kesh-tv-$VERSION.apk ($(du -h "dist/kesh-tv-$VERSION.apk" | cut -f1)) — abre $URL"
