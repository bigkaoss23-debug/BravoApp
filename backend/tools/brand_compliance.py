"""
brand_compliance.py — A14 Brand Compliance (zero LLM).

Checklist pass/fail per copy generato. Verifica regole del brand kit:
- Esclamazioni vietate
- Emoji vietate (feed)
- Hashtag count ≤ cap
- Word count headline/caption
- Regole rules_dont
"""

from __future__ import annotations

import re
from typing import TypedDict


class ComplianceResult(TypedDict):
    passed: bool
    checks: list[dict]   # [{name, passed, detail}]
    score: float          # 0.0–1.0 (percentuale check superati)


def check_compliance(
    headline: str,
    caption: str,
    brand_kit_opus: dict,
    format_type: str = "feed_post",
) -> ComplianceResult:
    """
    Verifica il copy contro le regole del brand.
    Restituisce pass/fail con dettaglio per ogni check.
    """
    checks: list[dict] = []

    identity = brand_kit_opus.get("identity", {})
    rules_dont = identity.get("rules_dont", []) or brand_kit_opus.get("rules_dont", [])
    ds_rules_dont = brand_kit_opus.get("design_system", {}).get("rules_dont", [])
    all_dont = rules_dont or ds_rules_dont

    format_rules = brand_kit_opus.get("format_rules", {})
    ds_format = brand_kit_opus.get("design_system", {}).get("format_rules", {})
    rules = format_rules or ds_format
    fmt = rules.get(format_type, rules.get("feed_post", {}))

    # ── 1. Esclamazioni ──────────────────────────────────────────────────
    excl_count = headline.count("!") + caption.count("!")
    checks.append({
        "name": "no_exclamaciones",
        "passed": excl_count == 0,
        "detail": f"{excl_count} exclamaciones encontradas" if excl_count else "OK",
    })

    # ── 2. Emoji (solo feed) ─────────────────────────────────────────────
    emoji_policy = fmt.get("emoji_policy", "nunca")
    if emoji_policy == "nunca" or format_type == "feed_post":
        emoji_pattern = re.compile(
            "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF"
            "\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U0001F900-\U0001F9FF"
            "\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF\U00002600-\U000026FF]"
        )
        emoji_found = emoji_pattern.findall(headline + caption)
        checks.append({
            "name": "no_emoji_feed",
            "passed": len(emoji_found) == 0,
            "detail": f"{len(emoji_found)} emoji encontrados" if emoji_found else "OK",
        })

    # ── 3. Hashtag count ─────────────────────────────────────────────────
    hashtags_in_caption = re.findall(r"#\w+", caption)
    max_hashtags = fmt.get("max_hashtags", 2)
    checks.append({
        "name": "hashtag_count",
        "passed": len(hashtags_in_caption) <= max_hashtags,
        "detail": f"{len(hashtags_in_caption)}/{max_hashtags} hashtags" if hashtags_in_caption else "OK (0 hashtags)",
    })

    # ── 4. Headline word count ───────────────────────────────────────────
    headline_words = len(headline.split())
    max_headline = 12
    checks.append({
        "name": "headline_length",
        "passed": headline_words <= max_headline,
        "detail": f"{headline_words} palabras (máx {max_headline})",
    })

    # ── 5. Caption non vuota ─────────────────────────────────────────────
    checks.append({
        "name": "caption_not_empty",
        "passed": len(caption.strip()) > 10,
        "detail": f"{len(caption.strip())} chars" if caption.strip() else "Caption vacía",
    })

    # ── 6. Rules_dont specifiche ─────────────────────────────────────────
    full_text = (headline + " " + caption).lower()
    for rule in all_dont:
        rule_low = rule.lower()
        violated = False

        if "filtros de alto contraste" in rule_low or "saturación excesiva" in rule_low:
            continue

        if "etiquetar a competidores" in rule_low or "comparaciones directas" in rule_low:
            competitors = brand_kit_opus.get("competitors", [])
            for comp in competitors:
                cname = comp.get("name", "").lower()
                if cname and cname in full_text:
                    violated = True
                    break

        if "contenido promocional agresivo" in rule_low:
            promo_words = ["descuento", "oferta", "reserva ahora", "últimas plazas", "solo hoy", "fomo"]
            violated = any(pw in full_text for pw in promo_words)

        if "más de dos hashtags" in rule_low:
            continue

        checks.append({
            "name": f"rule_dont: {rule[:50]}",
            "passed": not violated,
            "detail": "Violación detectada" if violated else "OK",
        })

    passed_count = sum(1 for c in checks if c["passed"])
    total = len(checks)
    score = passed_count / total if total > 0 else 1.0

    return ComplianceResult(
        passed=all(c["passed"] for c in checks),
        checks=checks,
        score=round(score, 2),
    )
