"""
copy_agent.py — A6 Copy Agent (Sonnet) · Fase 1B editorial.

Genera headline + whisper + caption da un CreativeBrief strutturato.
Input:  CreativeBrief dal BriefComposer + archetype opzionale (dal Layout Selector).
Output: {headline, headline_alt, whisper, caption, hashtags, ellipsis_used, _reasoning, _copy_log}

Regole editoriali Belvedere:
  - Sentence case (mai uppercase forzato — il renderer gestisce il caso)
  - Punteggiatura: niente = frammento dichiarativo · … = sospensione · . = frase con verbo
  - Limiti per archetipo:
      una_palabra      → esattamente 1 parola
      frase_susurro    → 2-5 headline + 4-8 whisper
      etiqueta_titulo  → 3-7 headline (label generata separata)
      ritmo_tres       → esattamente 3 parole (usare | come separatore)
      frase_narrativa  → 5-12 parole, una voce sola
      (nessuno)        → 4-8 parole
"""

from __future__ import annotations

import json
import os
import re
from typing import Optional

import anthropic

from agents.brief_composer import CreativeBrief, to_prompt_block


# ── Limiti per archetipo ───────────────────────────────────────────────────────

_ARCHETYPE_LIMITS: dict[str, dict] = {
    "una_palabra":     {"min": 1, "max": 1,  "whisper": False},
    "frase_susurro":   {"min": 2, "max": 5,  "whisper": True, "whisper_min": 4, "whisper_max": 8},
    "etiqueta_titulo": {"min": 3, "max": 7,  "whisper": False},
    "ritmo_tres":      {"min": 3, "max": 3,  "whisper": False},  # 3 parole con | come separatore
    "frase_narrativa": {"min": 5, "max": 12, "whisper": False},
    "mixed_type":      {"min": 3, "max": 8,  "whisper": True, "whisper_min": 3, "whisper_max": 6},
}
_DEFAULT_LIMITS = {"min": 4, "max": 8, "whisper": False}


# ── System prompt editoriale ───────────────────────────────────────────────────

_SYSTEM_BASE = """Eres el copy editorial. Lees el CREATIVE BRIEF y escribes en la voz que el brief te describe.

CÓMO TRABAJAS:
El brief contiene la voz de la marca, el ejemplo concreto de tono, la escena del ángulo,
el perfil de la persona y el mensaje que le resuena.
TODO eso es tu material: imítalo, no lo ignores. No traes voz de fuera.
Si el brief tiene un EJEMPLO CONCRETO DE VOZ, ese es tu norte tonal — imita el espíritu, no copies palabras.
Si el ÁNGULO tiene una escena/intención descrita, esa es la escena del post — no inventes otra.

ANTES DE ESCRIBIR, pregúntate:
1. ¿A quién hablas? — usa el perfil de la persona del brief
2. ¿Qué quiere este post de quien lo lee? — saca la intención del ángulo
3. ¿Cuál es el gesto que tu voz hace hacia esa persona?
4. ¿Qué palabra-clave del ángulo va al centro de ESTE post?

REGLAS DE FORMA (universales, valen siempre):
- Sentence case (primera letra mayúscula, resto minúsculo). NUNCA todo mayúsculas.
- Respeta el límite de palabras del ARCHETIPO indicado.
- Frases cortas. Silencios intencionados. Sin exclamaciones. Sin emojis en feed.
- Idioma del brief (español por defecto — ibérico salvo indicación contraria).
- Hashtags: solo los oficiales del brief (máx 2). Nunca inventes.
- Si el brief tiene REGLAS DE LA MARCA (no hacer), respétalas como ley.

PUNTUACIÓN DE LA HEADLINE:
- Sin marca final → fragmento declarativo, gesto o etiqueta
- «…» (U+2026, carácter único) → suspensión, atmósfera, silencio
- «.» → solo si es una frase completa con verbo conjugado
- NUNCA tres puntos separados «...» — siempre el carácter único «…»

HEADLINE Y WHISPER — DOS VOCES (cuando el archetipo lo pide):
La headline pone la escena. El whisper es el calor que la headline retiene:
la mano tendida, la pausa ofrecida, lo que la headline calla y la voz quiere decir.
NO repitas la headline con otras palabras — el whisper añade, no traduce.

CAPTION:
1. Primera línea: un gesto, no una promoción.
2. Desarrollo (1-3 frases según longitud): habla al lector, no de la marca.
3. Cierre suave — nunca CTA agresivo. Termina con punto.

OUTPUT — JSON exacto, sin texto fuera del JSON:
{
  "label": "etiqueta corta (hora/lugar/categoría) — SOLO si el archetipo la pide, si no \"\"",
  "headline": "frase en sentence case",
  "headline_alt": "variante alternativa en sentence case",
  "whisper": "frase susurro opcional (vacía si el archetipo no la requiere)",
  "caption": "texto completo de la caption",
  "hashtags": ["#Tag1", "#Tag2"],
  "ellipsis_used": true,
  "_reasoning": {
    "destinatario": "a quién hablas en este post",
    "intencion": "qué quiere este post de quien lo lee",
    "gesto": "el gesto que la voz hace hacia el lector",
    "palabra_clave": "la palabra del ángulo en el centro de este post",
    "decision": "resumen de la decisión principal de copy",
    "rejected": [
      {"option": "opción descartada", "reason": "motivo"}
    ],
    "confidence": 0.85
  }
}

Si el archetipo es «ritmo_tres», la headline son exactamente 3 palabras separadas por «|».
Si el archetipo NO necesita whisper, devuelve whisper como cadena vacía "".
El campo «label» SOLO se rellena si el archetipo es «etiqueta_titulo»; en todos
los demás archetipos devuelve label como cadena vacía "".
NUNCA metas la etiqueta dentro de la headline con separadores («·», «|», «—»).
"""

_ARCHETYPE_INSTRUCTIONS: dict[str, str] = {
    "una_palabra": (
        "ARCHETIPO: una_palabra\n"
        "La headline es UNA SOLA PALABRA. Una sola. Sin artículos, sin adjetivos.\n"
        "Debe ser sustantiva, evocadora, que llene el espacio visual.\n"
        "La palabra viene del brief — del léxico que el ángulo describe."
    ),
    "frase_susurro": (
        "ARCHETIPO: frase_susurro\n"
        "Headline: 2-5 palabras · fragmento o frase corta · voz principal.\n"
        "Whisper: 4-8 palabras · italic · voz secundaria que completa o amplía.\n"
        "Son dos voces distintas, no repeticiones.\n"
        "Ej headline: «El primer café» | Ej whisper: «antes de que despierte el valle»"
    ),
    "etiqueta_titulo": (
        "ARCHETIPO: etiqueta_titulo — DOS campos de texto separados:\n"
        "  · label: etiqueta corta (hora/lugar/categoría) · 1-4 palabras · "
        "sin punto final. Ej: «07:50» · «Terraza» · «Ronda, junio» · «El desayuno»\n"
        "  · headline: 3-7 palabras · la frase que acompaña la etiqueta.\n"
        "Son DOS textos distintos, NO los unas con «·» ni «|» ni «—». "
        "Tú escribes los dos; el agente designer decide DÓNDE van visualmente "
        "(posición, tamaño, color). Tú no decides layout, solo el texto.\n"
        "Ej correcto → label: «07:50» · headline: «El desayuno todavía espera»\n"
        "Ej INCORRECTO → headline: «07:50 · El desayuno todavía espera» (NO unir)"
    ),
    "ritmo_tres": (
        "ARCHETIPO: ritmo_tres\n"
        "La headline son EXACTAMENTE 3 PALABRAS separadas por «|».\n"
        "Ninguna más. Ninguna menos. Cada palabra debe poder estar sola.\n"
        "Sintaxis: «Palabra1|Palabra2|Palabra3» — las 3 palabras vienen del brief."
    ),
    "frase_narrativa": (
        "ARCHETIPO: frase_narrativa\n"
        "Headline: 5-12 palabras · una sola frase · una sola voz.\n"
        "No hay whisper, no hay etiqueta. Solo esta frase.\n"
        "Debe ser literaria, no publicitaria. Algo que podría ser una primera línea de un cuento.\n"
        "Estructura común: «Hay X que…» / «Cuando X, Y…» / «Antes de que X…» / «Aquí X se mide en Y.»\n"
        "El sujeto y las palabras vienen del brief de hoy."
    ),
    "mixed_type": (
        "ARCHETIPO: mixed_type\n"
        "Headline: 3-8 palabras · usa \\n para saltos de línea · usa {palabra} para italic en oro.\n"
        "La parte entre {} es el acento — la palabra que el ojo busca primero.\n"
        "Sintaxis: «Texto regular\\n{texto en italic oro}» o «{Acento italic}\\ntexto regular».\n"
        "El léxico y las palabras vienen del brief de hoy, no de estos ejemplos."
    ),
}

_FEW_SHOT = """
EJEMPLOS DE FORMA (referencia de estructura, NO de contenido — usan escenas neutras
para no contaminar tu léxico; tu lenguaje y tus palabras vienen del brief de hoy):

FORMA · frase_susurro (headline + whisper como dos voces)
  ✓ headline: "Una mesa pequeña"                          ← fragmento, sin marca
  ✓ whisper: "La que mira al jardín."                      ← frase con verbo, añade lo que la headline calla
  (el whisper NO traduce la headline — añade)

FORMA · una_palabra
  ✓ headline: "Pausa…"                                     ← una palabra + suspensión
  ✓ headline alt regular: "Llegada"                         ← sin marca

FORMA · ritmo_tres
  ✓ headline: "Camino|Vuelta|Mesa"                         ← exactamente 3 palabras con |

FORMA · mixed_type ({…} = italic en oro)
  ✓ headline: "Una vista\\n{que se queda}"                  ← \\n = nueva línea · {…} = acento italic
  ✓ whisper: "Te esperamos cuando quieras"                  ← gesto, voz ibérica
"""


class CopyAgent:
    """A6 · Copy Agent Belvedere — genera headline editoriale + whisper + caption."""

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        self.claude = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-6"

    def run(
        self,
        brief: CreativeBrief,
        extra_context: str = "",
        user_note: str = "",
        archetype: Optional[str] = None,
        max_headline_words: Optional[int] = None,  # override manuale (backward compat)
        recent_choices: Optional[dict] = None,     # memoria rotazione (Fase 1D)
    ) -> dict:
        """
        Genera headline + whisper + caption + _reasoning dal brief.
        archetype: uno dei 5 archetipi editoriali o None (usa limiti generici).
        recent_choices: output di get_recent_choices() — pattern già usati di recente.
        Restituisce {headline, headline_alt, whisper, caption, hashtags,
                     ellipsis_used, _reasoning, _copy_log}.
        """
        limits = _ARCHETYPE_LIMITS.get(archetype or "", _DEFAULT_LIMITS)
        max_words = max_headline_words or limits["max"]
        min_words = limits["min"]
        needs_whisper = limits.get("whisper", False)

        system = _build_system(archetype)

        brief_block = to_prompt_block(brief)
        user_msg = brief_block
        if extra_context:
            user_msg += f"\n\nCONTEXTO ADICIONAL:\n{extra_context}"
        if user_note:
            user_msg += f"\n\nNOTA DE BRAVO:\n{user_note}"
        if archetype:
            user_msg += f"\n\nARCHETYPE ELEGIDO: {archetype} (aplicar sus reglas de longitud)"

        # ── Memoria rotazione: pattern già scritti, evita di ripeterli ────────
        # Senza questo blocco il Copy Agent è cieco al passato e ricade sempre
        # sulle stesse formulazioni (es. '7:50|Café|Tajo', 'mermelada de higo',
        # 'luz que entra despacio'). Aggiunto 2026-05-15 dopo audit.
        if recent_choices and (recent_choices.get("decisions_count") or 0) > 0:
            from tools.decision_log import to_rotation_brief
            rotation_text = to_rotation_brief(recent_choices)
            if rotation_text:
                user_msg += (
                    "\n\n────────────────────────────────────\n"
                    "MEMORIA EDITORIAL — pattern ya usados recientemente.\n"
                    "EVITA repetir headline/whisper/caption con las mismas\n"
                    "palabras-clave o estructuras. Encuentra otro ángulo del\n"
                    "mismo brief, otro detalle, otro gesto. NO empieces la\n"
                    "headline con las mismas palabras de los posts recientes.\n"
                    "────────────────────────────────────\n"
                    f"{rotation_text}"
                )

        response = self.claude.messages.create(
            model=self.model,
            max_tokens=1200,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = response.content[0].text.strip()
        data = self._parse(raw, brief, archetype=archetype)
        data = _validate_editorial(data, archetype=archetype)

        # ── Decision log primer intento ────────────────────────────────────────
        first_headline = data.get("headline", "")
        first_n = _count_words(first_headline, archetype)
        copy_log = {
            "archetype": archetype or "none",
            "first_attempt": {
                "headline": first_headline,
                "headline_alt": data.get("headline_alt", ""),
                "whisper": data.get("whisper", ""),
                "words": first_n,
            },
            "retry_needed": False,
            "retry_reason": None,
            "final_words": first_n,
        }

        # ── Retry se headline fuori range ──────────────────────────────────────
        out_of_range = (first_n > max_words) or (min_words > 1 and first_n < min_words)
        if out_of_range and first_headline:
            print(f"   ↺ Copy retry — headline {first_n} parole (range {min_words}-{max_words})")
            copy_log["retry_needed"] = True
            copy_log["retry_reason"] = f"headline {first_n} palabras fuera del rango {min_words}-{max_words}"

            range_str = (
                f"exactamente {max_words}" if min_words == max_words
                else f"{min_words}-{max_words}"
            )
            retry_user = (
                f"La headline anterior tiene {first_n} palabras; necesita {range_str}. "
                f"Reescríbela manteniendo la misma voz e idea. "
                f"Devuelve el JSON completo actualizado."
            )
            response2 = self.claude.messages.create(
                model=self.model,
                max_tokens=1200,
                system=system,
                messages=[
                    {"role": "user", "content": user_msg},
                    {"role": "assistant", "content": raw},
                    {"role": "user", "content": retry_user},
                ],
            )
            raw2 = response2.content[0].text.strip()
            data2 = self._parse(raw2, brief, archetype=archetype)
            data2 = _validate_editorial(data2, archetype=archetype)
            new_n = _count_words(data2.get("headline", ""), archetype)
            if min_words <= new_n <= max_words and new_n > 0:
                data = data2
                copy_log["final_words"] = new_n
                print(f"   ✓ Copy retry OK ({new_n} palabras)")
            else:
                copy_log["retry_reason"] += f" → retry ancora fuori range ({new_n}), usata versione originale"
                print(f"   ⚠ Copy retry ancora fuori range ({new_n}), uso la prima versione")

        # ── Validazione label per etiqueta_titulo ──────────────────────────────
        # L'archetipo ha DUE testi separati (label + headline). Se il modello
        # non ha prodotto label, o ha infilato la label dentro la headline con
        # un separatore (· | —), forziamo un retry mirato. Niente cerotti a valle.
        if archetype == "etiqueta_titulo":
            label_val = (data.get("label") or "").strip()
            hl_val = (data.get("headline") or "").strip()
            sep_in_headline = any(s in hl_val for s in ("·", "|", " — ", " - "))
            if (not label_val) or sep_in_headline:
                reason = ("label vacía" if not label_val
                          else "separador dentro de la headline")
                print(f"   ↺ Copy retry label — {reason}")
                copy_log["label_retry"] = reason
                retry_label_user = (
                    "El archetipo es etiqueta_titulo: necesita DOS campos "
                    "separados.\n"
                    "  · label: etiqueta corta (hora/lugar/categoría), 1-4 "
                    "palabras, sin separadores.\n"
                    "  · headline: 3-7 palabras, la frase, SIN incluir la "
                    "etiqueta ni "
                    "«·» «|» «—».\n"
                    "Reescribe SOLO el JSON con label y headline bien "
                    "separados, manteniendo la misma voz e idea."
                )
                try:
                    response3 = self.claude.messages.create(
                        model=self.model,
                        max_tokens=1200,
                        system=system,
                        messages=[
                            {"role": "user", "content": user_msg},
                            {"role": "assistant", "content": raw},
                            {"role": "user", "content": retry_label_user},
                        ],
                    )
                    raw3 = response3.content[0].text.strip()
                    data3 = self._parse(raw3, brief, archetype=archetype)
                    data3 = _validate_editorial(data3, archetype=archetype)
                    new_label = (data3.get("label") or "").strip()
                    new_hl = (data3.get("headline") or "").strip()
                    new_sep = any(s in new_hl for s in ("·", "|", " — ", " - "))
                    if new_label and not new_sep:
                        data = data3
                        copy_log["label_retry_ok"] = True
                        print(f"   ✓ Copy label retry OK · label='{new_label}'")
                    else:
                        copy_log["label_retry_ok"] = False
                        print("   ⚠ Copy label retry non risolto — vedi debito tecnico")
                except Exception as e:
                    copy_log["label_retry_ok"] = False
                    print(f"   ⚠ Copy label retry errore: {e}")

        data["_copy_log"] = copy_log
        return data

    def _parse(self, raw: str, brief: CreativeBrief, archetype: Optional[str] = None) -> dict:
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {
                "headline": raw[:80],
                "caption": raw,
                "hashtags": brief.get("hashtags", [])[:2],
            }

        # Garantisce max 2 hashtag
        hashtags = data.get("hashtags", brief.get("hashtags", []))
        data["hashtags"] = hashtags[:2]

        # Garantisce whisper presente (stringa vuota se non necessario)
        if "whisper" not in data:
            data["whisper"] = ""

        # Garantisce ellipsis_used presente
        if "ellipsis_used" not in data:
            hl = data.get("headline", "") or ""
            data["ellipsis_used"] = "…" in hl

        # Garantisce _reasoning presente (struttura minima Belvedere)
        if "_reasoning" not in data or not isinstance(data.get("_reasoning"), dict):
            data["_reasoning"] = {
                "destinatario": "",
                "intencion": "",
                "gesto_anfitrion": "",
                "decision": "fallback parse",
                "primary_factor": "",
                "rejected": [],
                "confidence": 0.5,
            }

        return data


# ── Helpers ────────────────────────────────────────────────────────────────────

def _build_system(archetype: Optional[str]) -> str:
    """Assembla system prompt base + istruzioni specifiche archetipo + few-shot."""
    parts = [_SYSTEM_BASE]
    if archetype and archetype in _ARCHETYPE_INSTRUCTIONS:
        parts.append("\n\n" + _ARCHETYPE_INSTRUCTIONS[archetype])
    parts.append("\n\n" + _FEW_SHOT)
    return "".join(parts)


def _count_words(headline: str, archetype: Optional[str] = None) -> int:
    """Conta le parole della headline.
    Per ritmo_tres, conta i token separati da |.
    """
    if not headline:
        return 0
    if archetype == "ritmo_tres":
        return len([w.strip() for w in headline.split("|") if w.strip()])
    return len(headline.split())


def _validate_editorial(data: dict, archetype: Optional[str] = None) -> dict:
    """
    Validatore post-generazione:
    1. Converte '...' → '…' (carattere Unicode unico)
    2. Rimuove il punto finale da frammenti (headline senza verbo coniugato)
    3. Aggiorna ellipsis_used di conseguenza
    4. NON forza uppercase (il renderer gestisce il caso)
    """
    for field in ("label", "headline", "headline_alt", "whisper"):
        val = data.get(field, "") or ""
        val = _normalize_ellipsis(val)
        data[field] = val

    # Aggiorna ellipsis_used dopo la normalizzazione
    hl = data.get("headline", "") or ""
    data["ellipsis_used"] = "…" in hl

    return data


def _normalize_ellipsis(text: str) -> str:
    """Converte sequenze di punti (3+) nel carattere ellipsis U+2026."""
    if not text:
        return text
    text = re.sub(r'\.{3,}', '…', text)
    text = re.sub(r'\.\s*\.\s*\.+', '…', text)
    return text
