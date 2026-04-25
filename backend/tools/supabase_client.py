"""
supabase_client.py — Client Supabase condiviso per il backend BRAVO.

Singleton: il client viene inizializzato una volta e riutilizzato.
Se le credenziali mancano, ritorna None e il sistema cade back sul JSONL locale.
"""

import os
from typing import Optional

_client = None
_initialized = False


def get_client():
    """
    Ritorna il client Supabase o None se non configurato.
    Usare sempre questo, mai istanziare direttamente.
    """
    global _client, _initialized

    if _initialized:
        return _client

    _initialized = True
    url = os.getenv("SUPABASE_URL", "").strip()
    # Usa la secret key per lo storage — fallback alla anon key
    key = (os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY", "")).strip()

    if not url or not key:
        print("⚠️  Supabase non configurato — feedback salvato solo in locale (JSONL)")
        _client = None
        return None

    try:
        from supabase import create_client
        _client = create_client(url, key)
        print("✅ Supabase connesso")
    except Exception as e:
        print(f"⚠️  Supabase errore connessione: {e}")
        _client = None

    return _client
