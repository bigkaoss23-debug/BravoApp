"""
Test end-to-end del flusso onboarding canónico v2 su Belvedere.

NIENTE UI. Tutto locale. Simula gli step:
  1. Parser DOCX → 10 sezioni letterali
  2. save_briefing_sections → client_briefings
  3. populate client_team con i 5 macro-agenti
  4. ProjectExtractor → 2 progetti (feed + stories)
  5. INSERT su client_projects con le 4 colonne nuove

Lanciare da /Users/bigart/Downloads/files:
    cd backend && python scripts/test_belvedere_onboarding.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Carica .env del backend
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env", override=True)
except ImportError:
    print("⚠️  python-dotenv non installato — provo a leggere .env a mano")
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


BELVEDERE_ID = "c7ff1063-a4d0-4168-a68a-b0704ce3dee0"
DOCX_PATH = "/Users/bigart/Downloads/Belvedere_Briefing_ES.docx"


def step1_parse_docx():
    print("\n" + "=" * 70)
    print("STEP 1 · Parser DOCX canonico")
    print("=" * 70)
    from tools.briefing_docx_parser import parse_briefing_docx, BriefingFormatError
    with open(DOCX_PATH, "rb") as f:
        data = f.read()
    try:
        parsed = parse_briefing_docx(data)
    except BriefingFormatError as e:
        print(f"❌ ERRORE FORMATO: {e}")
        sys.exit(1)
    print(f"✅ {len(parsed.sections)} sezioni canoniche estratte")
    print(f"   counts = {parsed.counts}")
    print(f"\n   Anteprima sez. 02 (SCOPE — quella che ci interessa):")
    print("   " + "─" * 60)
    for line in (parsed.sections.get("02") or "").splitlines()[:10]:
        print(f"   │ {line}")
    print("   " + "─" * 60)
    return parsed


def step2_save_sections(parsed):
    print("\n" + "=" * 70)
    print("STEP 2 · Salva briefing_sections su client_briefings")
    print("=" * 70)
    from tools.briefing_store import save_briefing_sections
    row = save_briefing_sections(
        client_id=BELVEDERE_ID,
        briefing_text=parsed.raw_text,
        sections=parsed.sections,
        counts=parsed.counts,
        source_filename="Belvedere_Briefing_ES.docx",
    )
    print(f"✅ Salvato. briefing_format = {row.get('briefing_format', 'docx_canonical')}")


def step3_populate_team():
    print("\n" + "=" * 70)
    print("STEP 3 · Popola client_team con i 5 macro-agenti")
    print("=" * 70)
    from tools.supabase_client import get_client
    sb = get_client()
    if sb is None:
        print("❌ Supabase non disponibile")
        sys.exit(1)

    agents_res = sb.table("agents").select("id,slug,name").eq("active", True).order("name").execute()
    agents = agents_res.data or []
    print(f"Agenti attivi trovati: {[a['slug'] for a in agents]}")

    # Wipe + insert
    sb.table("client_team").delete().eq("client_id", BELVEDERE_ID).execute()
    rows = []
    for i, a in enumerate(agents):
        rows.append({
            "client_id": BELVEDERE_ID,
            "member_id": a["id"],
            "member_type": "agent",
            "role": "lead" if i == 0 else "collaborator",
            "active": True,
        })
    sb.table("client_team").insert(rows).execute()
    print(f"✅ {len(rows)} macro-agenti registrati per Belvedere")


def step4_extract_projects(parsed):
    print("\n" + "=" * 70)
    print("STEP 4 · ProjectExtractor sullo SCOPE")
    print("=" * 70)
    from agents.project_extractor import ProjectExtractor
    extractor = ProjectExtractor()
    result = extractor.run(parsed.sections)
    projects = result.get("projects", [])
    print(f"✅ {len(projects)} progetti estratti")
    for p in projects:
        print(f"\n  ┌─ {p.get('type')}")
        print(f"  │  title:        {p.get('title')}")
        print(f"  │  volume:       {p.get('volume')}")
        print(f"  │  frequency:    {p.get('frequency')}")
        print(f"  │  macro_agents: {p.get('macro_agents')}")
        print(f"  │  source_quote: {p.get('source_quote')}")
        print(f"  └─ description: {(p.get('description') or '')[:120]}")
    reasoning = result.get("_reasoning", {})
    if reasoning:
        print(f"\n  Reasoning extractor:")
        print(f"    scope_summary: {reasoning.get('scope_summary', '')[:150]}")
        print(f"    exclusions_respected: {reasoning.get('exclusions_respected')}")
        print(f"    decision_log: {reasoning.get('decision_log', '')[:200]}")
    return result, parsed.sections.get("02") or ""


def step5_save_projects(result, scope_literal):
    print("\n" + "=" * 70)
    print("STEP 5 · INSERT su client_projects (DELETE+INSERT su scope_extractor)")
    print("=" * 70)
    from tools.supabase_client import get_client
    import uuid as _uuid

    projects = result.get("projects", [])
    if not projects:
        print("⚠️  Nessun progetto da inserire")
        return

    sb = get_client()
    sb.table("client_projects").delete().eq("client_id", BELVEDERE_ID).eq("source", "scope_extractor").execute()

    rows = []
    for p in projects:
        macros = p.get("macro_agents") or []
        rows.append({
            "id": str(_uuid.uuid4()),
            "client_id": BELVEDERE_ID,
            "title": p["title"] or p["type"],
            "category": p["type"],
            "description": p.get("description") or "",
            "source_quote": p.get("source_quote") or "",
            "status": "propuesto",
            "source": "scope_extractor",
            "responsible_agent": macros[0] if macros else None,
            "co_agents": macros[1:] if len(macros) > 1 else [],
            "priority": "media",
            "project_type": p["type"],
            "volume": p.get("volume"),
            "frequency": p.get("frequency"),
            "scope_literal": scope_literal,
        })
    sb.table("client_projects").insert(rows).execute()
    print(f"✅ {len(rows)} progetti scritti su client_projects")


def step6_verify():
    print("\n" + "=" * 70)
    print("STEP 6 · Verifica finale")
    print("=" * 70)
    from tools.supabase_client import get_client
    sb = get_client()
    res = (
        sb.table("client_projects")
        .select("project_type,title,volume,frequency,responsible_agent,co_agents,source_quote,scope_literal")
        .eq("client_id", BELVEDERE_ID)
        .eq("source", "scope_extractor")
        .execute()
    )
    rows = res.data or []
    print(f"Progetti 'scope_extractor' presenti per Belvedere: {len(rows)}\n")
    for r in rows:
        print(f"  • [{r['project_type']}] vol={r['volume']} freq={r['frequency']}")
        print(f"    responsible={r['responsible_agent']} co={r['co_agents']}")
        print(f"    quote: \"{r['source_quote']}\"")
        sl = r.get("scope_literal") or ""
        print(f"    scope_literal: {len(sl)} chars (anteprima: {sl[:80]!r})")
        print()


def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("❌ ANTHROPIC_API_KEY non trovata in env")
        sys.exit(1)
    if not os.environ.get("SUPABASE_URL"):
        print("❌ SUPABASE_URL non trovata in env")
        sys.exit(1)

    parsed = step1_parse_docx()
    step2_save_sections(parsed)
    step3_populate_team()
    result, scope_literal = step4_extract_projects(parsed)
    step5_save_projects(result, scope_literal)
    step6_verify()

    print("\n" + "=" * 70)
    print("🎉 ONBOARDING CANÓNICO V2 — FLUSSO COMPLETO OK")
    print("=" * 70)


if __name__ == "__main__":
    main()
