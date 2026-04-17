from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum
import uuid


class ContentPillar(str, Enum):
    PRODUCTO = "PRODUCTO"
    AGRONOMIA = "AGRONOMIA"
    EQUIPO = "EQUIPO"
    TECNOLOGIA = "TECNOLOGIA"
    CLIENTE = "CLIENTE"
    CALENDARIO = "CALENDARIO"


class ContentFormat(str, Enum):
    STORY = "Story 9:16"
    POST = "Post 1:1"
    CAROUSEL = "Carosello"
    REEL_COVER = "Portada Reel"


class Platform(str, Enum):
    FACEBOOK = "Facebook"
    INSTAGRAM = "Instagram"
    LINKEDIN = "LinkedIn"


# --- Request ---

class GenerateContentRequest(BaseModel):
    """
    Input per generare un contenuto per DaKady.
    Tutti i campi sono opzionali — se non specificati,
    l'agente li decide in autonomia in base al brief.
    """
    brief: str
    # Es: "genera un post sul prodotto BRAVERIA per la fase di arranque"
    # Es: "crea una storia sul risultato ottenuto con Samanta (trips calabacín)"

    client_id: str = "dakady"
    platform: Optional[Platform] = Platform.INSTAGRAM
    pillar: Optional[ContentPillar] = None
    format: Optional[ContentFormat] = None
    num_contents: int = 1  # quanti contenuti generare
    generate_image: bool = False  # se True, chiama Ideogram per ogni contenuto


# --- Response ---

class LayoutVariant(str, Enum):
    # Classic variants (original)
    BOTTOM_LEFT  = "bottom-left"
    BOTTOM_RIGHT = "bottom-right"
    BOTTOM_FULL  = "bottom-full"
    TOP_LEFT     = "top-left"
    TOP_RIGHT    = "top-right"
    CENTER       = "center"

    # DaKady brand variants (new)
    CENTERED_HEADER = "centered-header"
    CENTERED_WITH_LOGO = "centered-with-logo"
    ASYMMETRIC_LEFT = "asymmetric-left"
    ASYMMETRIC_RIGHT = "asymmetric-right"


class OverlayText(BaseModel):
    headline: str
    body: Optional[str] = None
    layout_variant: LayoutVariant = LayoutVariant.BOTTOM_LEFT
    logo_position: str = "top-center"

    # New parameters for DaKady brand variants
    label: Optional[str] = None  # Red/orange subtitle (centered layouts)
    subtitle_color: tuple = (255, 127, 80)  # RGB for label, default ORANGE
    side: Optional[str] = "left"  # "left" or "right" for asymmetric layouts


class GeneratedImage(BaseModel):
    url: str
    resolution: Optional[str] = None
    is_image_safe: bool = True


class ContentItem(BaseModel):
    content_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pillar: ContentPillar
    format: ContentFormat
    platform: Platform
    content_type: str   # "Product Showcase", "Visita Técnica", "TRAMPA", ecc.

    visual_prompt: str  # prompt per Ideogram (in inglese)
    overlay: OverlayText
    caption: str        # testo completo in spagnolo con hashtag
    agent_notes: Optional[str] = None  # ragionamento interno di Claude sul layout scelto
    image: Optional[GeneratedImage] = None  # presente se generate_image=True


class GenerateContentResponse(BaseModel):
    client_id: str
    contents: list[ContentItem]
    agent_notes: Optional[str] = None  # note interne dell'agente


# =============================================
# FEEDBACK LOOP
# =============================================

class ContentFeedback(BaseModel):
    """
    Feedback inviato da BRAVO su un contenuto generato.
    - status="rejected" + rejection_reason: errore da evitare
    - status="approved" + liked_aspects: pattern da ripetere
    Questi dati vengono aggregati in regole sintetiche per migliorare
    le generazioni future (vedi tools/feedback_store.summarize_feedback).
    """
    content_id: str                          # ID del ContentItem valutato
    client_id: str = "dakady"
    status: Literal["approved", "rejected", "revised"]
    rejection_reason: Optional[str] = None  # cosa non andava — scritto da BRAVO
    liked_aspects: Optional[list[str]] = None  # cosa ha funzionato (es. ["tono diretto", "headline breve"])
    # Snapshot del contenuto valutato (per capire cosa correggere/ripetere)
    original_brief: Optional[str] = None
    headline: Optional[str] = None
    layout_variant: Optional[str] = None
    pillar: Optional[str] = None             # pilastro del post valutato
    caption_preview: Optional[str] = None   # prime 200 chars della caption
    agent_notes: Optional[str] = None       # ragionamento originale di Claude


class FeedbackResponse(BaseModel):
    """Risposta confermata dal server dopo aver salvato il feedback."""
    saved: bool
    content_id: str
    message: str
