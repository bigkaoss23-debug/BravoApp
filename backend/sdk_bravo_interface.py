"""
SDK BRAVO — Interfaccia per l'integrazione nell'app BRAVO

Questo SDK definisce come l'app BRAVO dovrà comunicare con il nostro agente.

WORKFLOW:
1. L'app BRAVO raccoglie foto e testi durante la settimana
2. L'app BRAVO chiama il nostro SDK via API
3. Il nostro SDK recupera foto e testi da BRAVO
4. Genera 5 post coerenti
5. Ritorna i post a BRAVO

===== STRUTTURA DATABASE CHE BRAVO DEVE AVERE =====

TABELLA: weekly_context
├─ context_id (UUID)
├─ week_start (data)
├─ theme (string) — "Fase arranque con BRAVERIA"
├─ technical_points (JSON) — lista di punti tecnici
├─ narrative_angles (JSON) — lista di 8 angoli narrativi
├─ featured_products (JSON) — ["BRAVERIA", "AIGRO sensori"]
├─ team_members (JSON) — ["Chema", "Camilo", "María"]
└─ created_at (timestamp)

TABELLA: weekly_content_photos
├─ photo_id (UUID)
├─ context_id (FK → weekly_context)
├─ photo_url (string) — "s3://bravo-bucket/photos/photo_123.jpg"
├─ photo_date (data)
├─ photo_description (string) — "Chema in campo con sensori AIGRO"
├─ position_in_photo (string) — "top-left", "center", "bottom-right", ecc.
└─ uploaded_at (timestamp)

TABELLA: weekly_content_texts
├─ text_id (UUID)
├─ context_id (FK → weekly_context)
├─ content_type (enum) — "chat_message", "voice_note", "field_report"
├─ text_content (string) — "Oggi Chema ha detto che..."
├─ author (string) — "Chema", "tecnico", "fotografo"
├─ text_date (data)
├─ importance_level (int) — 1-5, per prioritizzare
└─ created_at (timestamp)

TABELLA: generated_posts
├─ post_id (UUID)
├─ context_id (FK → weekly_context)
├─ photo_id (FK → weekly_content_photos)
├─ headline (string)
├─ body (string)
├─ caption (string) — testo completo Instagram
├─ layout_variant (string)
├─ created_at (timestamp)
├─ status (enum) — "pending", "approved", "published"
└─ published_url (string) — link al post pubblicato
"""

from typing import Optional, List, Dict
from dataclasses import dataclass
from datetime import datetime
from abc import ABC, abstractmethod
import json


# ===== MODELLI DATI =====

@dataclass
class BravoPhoto:
    """Una foto caricata in BRAVO"""
    photo_id: str
    photo_url: str  # URL accessibile pubblicamente o token autenticato
    photo_date: datetime
    photo_description: str
    position_in_photo: str  # "top-left", "center", "bottom-right", ecc.


@dataclass
class BravoText:
    """Un testo/conversazione caricato in BRAVO"""
    text_id: str
    content_type: str  # "chat_message", "voice_note", "field_report"
    text_content: str
    author: str  # "Chema", "fotografo", "tecnico"
    text_date: datetime
    importance_level: int  # 1-5


@dataclass
class BravoWeeklyContext:
    """Contesto settimanale salvato in BRAVO"""
    context_id: str
    week_start: datetime
    theme: str  # "Fase arranque con BRAVERIA"
    technical_points: List[str]  # ["Radici si sviluppano...", ...]
    narrative_angles: List[str]  # ["Hook provocatorio", "Caso studio", ...]
    featured_products: List[str]  # ["BRAVERIA", "AIGRO"]
    team_members: List[str]  # ["Chema", "Camilo"]


@dataclass
class GeneratedPost:
    """Post generato dal nostro agente"""
    post_id: str
    headline: str
    body: Optional[str]
    caption: str
    layout_variant: str
    photo_url: str
    pillar: str
    content_type: str


# ===== INTERFACCIA CHE BRAVO DEVE IMPLEMENTARE =====

class BravoAPIInterface(ABC):
    """
    Interfaccia che l'app BRAVO deve implementare.

    Il nostro SDK chiamerà questi metodi per recuperare
    foto e testi da BRAVO.
    """

    @abstractmethod
    def get_weekly_context(self, context_id: str) -> BravoWeeklyContext:
        """
        Recupera il contesto settimanale da BRAVO.

        Args:
            context_id: ID del contesto settimanale

        Returns:
            BravoWeeklyContext con tema, prodotti, angoli narrativi
        """
        pass

    @abstractmethod
    def get_photos_for_context(
        self, context_id: str, limit: int = 10
    ) -> List[BravoPhoto]:
        """
        Recupera le foto caricate in BRAVO per questo contesto.

        Args:
            context_id: ID del contesto settimanale
            limit: Numero massimo di foto da recuperare

        Returns:
            Lista di BravoPhoto
        """
        pass

    @abstractmethod
    def get_texts_for_context(
        self, context_id: str, min_importance: int = 1
    ) -> List[BravoText]:
        """
        Recupera i testi/conversazioni caricate in BRAVO per questo contesto.

        Args:
            context_id: ID del contesto settimanale
            min_importance: Filtra solo testi con importanza >= questo valore

        Returns:
            Lista di BravoText (ordinate per data)
        """
        pass

    @abstractmethod
    def save_generated_posts(
        self, context_id: str, posts: List[GeneratedPost]
    ) -> bool:
        """
        Salva i post generati nel database BRAVO.

        Args:
            context_id: ID del contesto settimanale
            posts: Lista di post generati

        Returns:
            True se salvati con successo
        """
        pass


# ===== IMPLEMENTAZIONE PER BRAVO (DA FARE IN BRAVO) =====

class BravoAPIImplementation(BravoAPIInterface):
    """
    Implementazione concreta per comunicare con BRAVO via REST API.

    QUESTA CLASSE DEVE ESSERE IMPLEMENTATA NELL'APP BRAVO!

    Esempio (pseudocodice):

    class BravoAPIImplementation(BravoAPIInterface):
        def __init__(self, bravo_api_url: str, auth_token: str):
            self.api_url = bravo_api_url
            self.headers = {"Authorization": f"Bearer {auth_token}"}

        def get_weekly_context(self, context_id: str) -> BravoWeeklyContext:
            response = requests.get(
                f"{self.api_url}/api/v1/context/{context_id}",
                headers=self.headers
            )
            data = response.json()
            return BravoWeeklyContext(
                context_id=data["id"],
                week_start=datetime.fromisoformat(data["week_start"]),
                theme=data["theme"],
                technical_points=data["technical_points"],
                narrative_angles=data["narrative_angles"],
                featured_products=data["featured_products"],
                team_members=data["team_members"]
            )

        def get_photos_for_context(self, context_id: str, limit: int = 10):
            response = requests.get(
                f"{self.api_url}/api/v1/context/{context_id}/photos",
                params={"limit": limit},
                headers=self.headers
            )
            photos = []
            for item in response.json()["items"]:
                photos.append(BravoPhoto(
                    photo_id=item["id"],
                    photo_url=item["url"],
                    photo_date=datetime.fromisoformat(item["date"]),
                    photo_description=item["description"],
                    position_in_photo=item.get("position", "center")
                ))
            return photos

        def get_texts_for_context(self, context_id: str, min_importance: int = 1):
            response = requests.get(
                f"{self.api_url}/api/v1/context/{context_id}/texts",
                params={"min_importance": min_importance},
                headers=self.headers
            )
            texts = []
            for item in response.json()["items"]:
                texts.append(BravoText(
                    text_id=item["id"],
                    content_type=item["type"],
                    text_content=item["content"],
                    author=item["author"],
                    text_date=datetime.fromisoformat(item["date"]),
                    importance_level=item.get("importance", 3)
                ))
            return texts

        def save_generated_posts(self, context_id: str, posts: List[GeneratedPost]):
            payload = {
                "context_id": context_id,
                "posts": [
                    {
                        "headline": p.headline,
                        "body": p.body,
                        "caption": p.caption,
                        "layout_variant": p.layout_variant,
                        "photo_url": p.photo_url,
                        "pillar": p.pillar
                    }
                    for p in posts
                ]
            }
            response = requests.post(
                f"{self.api_url}/api/v1/context/{context_id}/posts",
                json=payload,
                headers=self.headers
            )
            return response.status_code == 201
    """

    def __init__(self, bravo_api_url: str, auth_token: str):
        """
        Inizializza il client API BRAVO.

        Args:
            bravo_api_url: URL dell'app BRAVO (es. "https://bravo.example.com")
            auth_token: Token di autenticazione per le API BRAVO
        """
        self.api_url = bravo_api_url.rstrip("/")
        self.auth_token = auth_token
        self.headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }

    def get_weekly_context(self, context_id: str) -> BravoWeeklyContext:
        """Implementazione stub — da completare in BRAVO"""
        raise NotImplementedError("Implementare in BRAVO con requests HTTP")

    def get_photos_for_context(self, context_id: str, limit: int = 10) -> List[BravoPhoto]:
        """Implementazione stub — da completare in BRAVO"""
        raise NotImplementedError("Implementare in BRAVO con requests HTTP")

    def get_texts_for_context(self, context_id: str, min_importance: int = 1) -> List[BravoText]:
        """Implementazione stub — da completare in BRAVO"""
        raise NotImplementedError("Implementare in BRAVO con requests HTTP")

    def save_generated_posts(self, context_id: str, posts: List[GeneratedPost]) -> bool:
        """Implementazione stub — da completare in BRAVO"""
        raise NotImplementedError("Implementare in BRAVO con requests HTTP")


# ===== ENDPOINT API CHE BRAVO DEVE ESPORRE =====

"""
L'app BRAVO deve esporre questi endpoint REST:

GET /api/v1/context/{context_id}
└─ Ritorna: { id, theme, week_start, technical_points, narrative_angles, featured_products }

GET /api/v1/context/{context_id}/photos
└─ Ritorna: { items: [ { id, url, date, description, position }, ... ] }

GET /api/v1/context/{context_id}/texts
└─ Ritorna: { items: [ { id, type, content, author, date, importance }, ... ] }

POST /api/v1/context/{context_id}/posts
├─ Body: { posts: [ { headline, body, caption, layout_variant, photo_url }, ... ] }
└─ Ritorna: { status: "created", post_ids: [...] }
"""
