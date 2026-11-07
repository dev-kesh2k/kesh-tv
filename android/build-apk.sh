#!/usr/bin/env bash
# Mantido por compatibilidade: o gerador agora fica na raiz e oferece WebView, Kotlin e Flutter.
#   android/build-apk.sh [versão] [endereço]  =  ./build-apk.sh webview [versão] [endereço]
exec "$(dirname "$0")/../build-apk.sh" webview "$@"
