"""
hashtag_selector.py — A12 Hashtag Selector (zero LLM).

Sceglie 2 hashtag dal brand kit. Cap fisso = 2 per post feed.
Default pair + sostituzione stagionale opzionale.
"""

from __future__ import annotations

from typing import Optional


def select_hashtags(
    brand_kit_opus: dict,
    season_level: Optional[str] = None,
    pillar: Optional[str] = None,
    max_count: int = 2,
) -> list[str]:
    """
    Seleziona hashtag per un post.

    Logica:
    1. Prende gli hashtag ufficiali dal brand kit (key_messages.hashtags)
    2. Se ce ne sono più di max_count, prende i primi max_count
    3. Non inventa mai hashtag — usa solo quelli definiti nel brand kit

    Il cap di 2 è una regola del brand Belvedere (rules_dont: "No usar más de
    dos hashtags por post de feed"). Altri clienti potrebbero avere cap diverso.
    """
    hashtags = _get_official_hashtags(brand_kit_opus)

    format_rules = brand_kit_opus.get("format_rules", {})
    ds_format = brand_kit_opus.get("design_system", {}).get("format_rules", {})
    rules = format_rules or ds_format
    feed_rules = rules.get("feed_post", rules.get("single_post", {}))
    cap = feed_rules.get("max_hashtags", max_count)

    return hashtags[:cap]


def _get_official_hashtags(brand_kit_opus: dict) -> list[str]:
    """Estrae gli hashtag ufficiali dal brand kit."""
    direct = brand_kit_opus.get("hashtags", [])
    if direct:
        return direct

    km = brand_kit_opus.get("key_messages", {})
    if km.get("hashtags"):
        return km["hashtags"]

    return []
