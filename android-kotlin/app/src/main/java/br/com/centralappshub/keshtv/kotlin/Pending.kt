package br.com.centralappshub.keshtv.kotlin

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

@Composable fun FavoritesScreen(api: Api, onOpen: (Channel) -> Unit, onBack: () -> Unit) { Text("Favoritos") }
@Composable fun AccountScreen(api: Api, store: Store, onLogout: () -> Unit, onBack: () -> Unit) { Text("Conta") }
