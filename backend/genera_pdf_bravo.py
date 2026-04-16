"""
Genera il PDF "Come costruire un'applicazione che dura"
da consegnare a BRAVO Studio.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.platypus import PageBreak
from reportlab.lib.colors import HexColor
from pathlib import Path

# ── Colori brand ────────────────────────────────────────────────
RED      = HexColor('#C0392B')
DARK     = HexColor('#0C0C0C')
DARKGRAY = HexColor('#1A1A1A')
MIDGRAY  = HexColor('#2E2E2E')
LIGHTGRAY= HexColor('#888888')
WHITE    = HexColor('#FFFFFF')
OFFWHITE = HexColor('#F5F5F5')
GREEN    = HexColor('#27AE60')
BLUE     = HexColor('#2980B9')
ORANGE   = HexColor('#F39C12')
LIGHT_RED= HexColor('#F9EBEA')
LIGHT_GREEN = HexColor('#EAFAF1')

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

OUTPUT = Path(__file__).parent / "BRAVO_GUIDA_SVILUPPO.pdf"


# ── Stili ────────────────────────────────────────────────────────
def make_styles():
    return {
        'eyebrow': ParagraphStyle('eyebrow',
            fontName='Helvetica-Bold', fontSize=8,
            textColor=RED, spaceAfter=4, spaceBefore=0,
            letterSpacing=2, leading=12),

        'h1': ParagraphStyle('h1',
            fontName='Helvetica-Bold', fontSize=28,
            textColor=DARK, spaceAfter=8, spaceBefore=0,
            leading=32),

        'h1_red': ParagraphStyle('h1_red',
            fontName='Helvetica-Bold', fontSize=28,
            textColor=RED, spaceAfter=16, spaceBefore=0,
            leading=32),

        'h2': ParagraphStyle('h2',
            fontName='Helvetica-Bold', fontSize=17,
            textColor=DARK, spaceAfter=6, spaceBefore=20,
            leading=22),

        'h3': ParagraphStyle('h3',
            fontName='Helvetica-Bold', fontSize=12,
            textColor=DARK, spaceAfter=4, spaceBefore=12,
            leading=16),

        'body': ParagraphStyle('body',
            fontName='Helvetica', fontSize=10,
            textColor=HexColor('#333333'), spaceAfter=6,
            leading=16, alignment=TA_JUSTIFY),

        'body_muted': ParagraphStyle('body_muted',
            fontName='Helvetica', fontSize=10,
            textColor=LIGHTGRAY, spaceAfter=6,
            leading=16),

        'label': ParagraphStyle('label',
            fontName='Helvetica-Bold', fontSize=7,
            textColor=RED, spaceAfter=2, spaceBefore=0,
            letterSpacing=1.5, leading=10),

        'caption': ParagraphStyle('caption',
            fontName='Helvetica', fontSize=9,
            textColor=LIGHTGRAY, spaceAfter=4, leading=13),

        'highlight': ParagraphStyle('highlight',
            fontName='Helvetica', fontSize=10,
            textColor=HexColor('#2C2C2C'), spaceAfter=4,
            leading=16, leftIndent=12),

        'highlight_label': ParagraphStyle('highlight_label',
            fontName='Helvetica-Bold', fontSize=7,
            textColor=RED, spaceAfter=4,
            letterSpacing=1.5, leading=10, leftIndent=12),

        'rule_num': ParagraphStyle('rule_num',
            fontName='Helvetica-Bold', fontSize=24,
            textColor=HexColor('#E0E0E0'), spaceAfter=0,
            leading=28),

        'rule_title': ParagraphStyle('rule_title',
            fontName='Helvetica-Bold', fontSize=11,
            textColor=DARK, spaceAfter=3,
            leading=14),

        'rule_body': ParagraphStyle('rule_body',
            fontName='Helvetica', fontSize=9.5,
            textColor=HexColor('#444444'), spaceAfter=0,
            leading=14, alignment=TA_JUSTIFY),

        'step_who': ParagraphStyle('step_who',
            fontName='Helvetica-Bold', fontSize=7,
            textColor=RED, spaceAfter=2,
            letterSpacing=1.5, leading=10),

        'step_what': ParagraphStyle('step_what',
            fontName='Helvetica-Bold', fontSize=10,
            textColor=DARK, spaceAfter=0, leading=13),

        'step_body': ParagraphStyle('step_body',
            fontName='Helvetica', fontSize=9.5,
            textColor=HexColor('#444444'), spaceAfter=0,
            leading=14, alignment=TA_JUSTIFY),

        'pill_blue': ParagraphStyle('pill_blue',
            fontName='Helvetica-Bold', fontSize=8,
            textColor=BLUE, spaceAfter=0, leading=11),

        'pill_green': ParagraphStyle('pill_green',
            fontName='Helvetica-Bold', fontSize=8,
            textColor=GREEN, spaceAfter=0, leading=11),

        'pill_orange': ParagraphStyle('pill_orange',
            fontName='Helvetica-Bold', fontSize=8,
            textColor=ORANGE, spaceAfter=0, leading=11),

        'tbl_header': ParagraphStyle('tbl_header',
            fontName='Helvetica-Bold', fontSize=8,
            textColor=WHITE, leading=11),

        'tbl_cell': ParagraphStyle('tbl_cell',
            fontName='Helvetica', fontSize=9,
            textColor=HexColor('#333333'), leading=13),

        'tbl_cell_bold': ParagraphStyle('tbl_cell_bold',
            fontName='Helvetica-Bold', fontSize=9,
            textColor=HexColor('#111111'), leading=13),

        'footer': ParagraphStyle('footer',
            fontName='Helvetica', fontSize=8,
            textColor=LIGHTGRAY, alignment=TA_CENTER, leading=10),
    }


# ── Helper: sezione con sfondo colorato ─────────────────────────
def section_box(content_rows, bg=OFFWHITE, border=HexColor('#E0E0E0')):
    tbl = Table([[content_rows]], colWidths=[PAGE_W - 2*MARGIN])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg),
        ('ROUNDEDCORNERS', [6,6,6,6]),
        ('BOX',       (0,0), (-1,-1), 0.5, border),
        ('TOPPADDING',  (0,0), (-1,-1), 12),
        ('BOTTOMPADDING',(0,0),(-1,-1), 12),
        ('LEFTPADDING', (0,0), (-1,-1), 16),
        ('RIGHTPADDING',(0,0), (-1,-1), 16),
    ]))
    return tbl


def divider():
    return HRFlowable(width='100%', thickness=0.5, color=HexColor('#E5E5E5'),
                      spaceAfter=20, spaceBefore=20)


# ── On-page header/footer ────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4

    # Header bar
    canvas.setFillColor(DARK)
    canvas.rect(0, h - 14*mm, w, 14*mm, fill=1, stroke=0)
    # Red dot
    canvas.setFillColor(RED)
    canvas.circle(MARGIN + 5*mm, h - 7*mm, 4*mm, fill=1, stroke=0)
    # Title
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.drawString(MARGIN + 12*mm, h - 8.5*mm, 'DaKady® × BRAVO Studio')
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(LIGHTGRAY)
    canvas.drawRightString(w - MARGIN, h - 8.5*mm, 'GUIDA TECNICA RISERVATA')

    # Footer
    canvas.setFillColor(HexColor('#F0F0F0'))
    canvas.rect(0, 0, w, 8*mm, fill=1, stroke=0)
    canvas.setFillColor(LIGHTGRAY)
    canvas.setFont('Helvetica', 7)
    canvas.drawString(MARGIN, 3*mm, 'DaKady® × BRAVO Studio — Documento riservato · Aprile 2026')
    canvas.drawRightString(w - MARGIN, 3*mm, f'Pagina {doc.page}')

    canvas.restoreState()


# ── Builder ──────────────────────────────────────────────────────
def build():
    S = make_styles()
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=20*mm, bottomMargin=14*mm,
        title="Come costruire un'applicazione che dura — BRAVO Studio",
        author="DaKady® × BRAVO Studio",
    )
    story = []
    CW = PAGE_W - 2 * MARGIN  # usable column width

    # ── COPERTINA ──────────────────────────────────────────────
    story.append(Spacer(1, 18*mm))
    story.append(Paragraph("DOCUMENTO TECNICO — APRILE 2026", S['eyebrow']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Come costruire un'applicazione", S['h1']))
    story.append(Paragraph("che dura.", S['h1_red']))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Questo documento spiega la filosofia, la struttura e le regole che rendono "
        "un'applicazione AI solida, manutenibile e scalabile nel tempo. "
        "È la stessa logica che abbiamo usato per costruire il backend di DaKady®.",
        S['body']))
    story.append(divider())

    # ── SEZ 1: IL PROBLEMA ─────────────────────────────────────
    story.append(Paragraph("IL PUNTO DI PARTENZA", S['label']))
    story.append(Paragraph("Perché la maggior parte delle app si rompe.", S['h2']))
    story.append(Paragraph(
        "Non si rompe perché il programmatore era bravo o meno bravo. Si rompe perché è "
        "stata costruita senza una struttura chiara. Ogni pezzo sapeva tutto degli altri — "
        "e quando cambiava uno, cadevano tutti.",
        S['body']))
    story.append(Spacer(1, 8))

    # Tabella comparativa
    comp_data = [
        [
            Paragraph("APP FRAGILE", ParagraphStyle('', fontName='Helvetica-Bold',
                fontSize=8, textColor=RED, letterSpacing=1)),
            Paragraph("APP DURATURA", ParagraphStyle('', fontName='Helvetica-Bold',
                fontSize=8, textColor=GREEN, letterSpacing=1)),
        ],
        [
            Paragraph("✗  Tutto il codice nello stesso file\n"
                      "✗  Una modifica rompe tre cose non collegate\n"
                      "✗  Aggiungere un cliente richiede settimane\n"
                      "✗  I bug si nascondono in silenzio\n"
                      "✗  Nessuno sa perché funziona — o non funziona\n"
                      "✗  Il sistema non migliora mai nel tempo",
                ParagraphStyle('', fontName='Helvetica', fontSize=9.5,
                    textColor=HexColor('#555'), leading=17)),
            Paragraph("✓  Ogni file fa una sola cosa\n"
                      "✓  Tocchi una parte, il resto non si accorge\n"
                      "✓  Aggiungere un cliente è questione di minuti\n"
                      "✓  Gli errori emergono subito, in modo chiaro\n"
                      "✓  Il codice si legge come una frase\n"
                      "✓  Il sistema diventa più intelligente ogni settimana",
                ParagraphStyle('', fontName='Helvetica', fontSize=9.5,
                    textColor=HexColor('#333'), leading=17)),
        ],
    ]
    comp_tbl = Table(comp_data, colWidths=[CW/2, CW/2])
    comp_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (0,0), LIGHT_RED),
        ('BACKGROUND',    (1,0), (1,0), LIGHT_GREEN),
        ('BACKGROUND',    (0,1), (0,1), HexColor('#FDF5F5')),
        ('BACKGROUND',    (1,1), (1,1), HexColor('#F5FDF8')),
        ('BOX',           (0,0), (-1,-1), 0.5, HexColor('#DDD')),
        ('INNERGRID',     (0,0), (-1,-1), 0.5, HexColor('#E8E8E8')),
        ('TOPPADDING',    (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING',   (0,0), (-1,-1), 12),
        ('RIGHTPADDING',  (0,0), (-1,-1), 12),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(comp_tbl)
    story.append(Spacer(1, 10))

    # Highlight box
    highlight_data = [[
        Paragraph("IL PRINCIPIO FONDAMENTALE", S['highlight_label']),
        Paragraph(
            "Un'applicazione ben costruita è come una cucina professionale. "
            "Chi cucina non si occupa di comprare gli ingredienti. "
            "Chi compra non decide il menu. Chi gestisce la sala non entra in cucina. "
            "Ogni persona fa una cosa sola — e la fa benissimo. "
            "Quando qualcosa va storto, sai esattamente dove guardare.",
            S['highlight']),
    ]]
    hl_tbl = Table([[highlight_data[0]]], colWidths=[CW])
    hl_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), HexColor('#FEF9F9')),
        ('LEFTPADDING',  (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('TOPPADDING',   (0,0), (-1,-1), 12),
        ('BOTTOMPADDING',(0,0), (-1,-1), 12),
        ('LINEBEFORE',   (0,0), (0,-1), 3, RED),
        ('BOX',          (0,0), (-1,-1), 0.5, HexColor('#F5C6C2')),
    ]))
    story.append(hl_tbl)
    story.append(divider())

    # ── SEZ 2: LO STACK ────────────────────────────────────────
    story.append(Paragraph("LA SCELTA TECNOLOGICA", S['label']))
    story.append(Paragraph("Perché Python. Perché questo stack.", S['h2']))
    story.append(Paragraph(
        "Non esiste una scelta 'giusta' in assoluto. Ma per un sistema che usa AI, "
        "elabora immagini e deve crescere nel tempo, Python è la scelta più intelligente disponibile oggi.",
        S['body']))
    story.append(Spacer(1, 8))

    stack_data = [
        [
            Paragraph("🐍  PYTHON", ParagraphStyle('', fontName='Helvetica-Bold', fontSize=10, textColor=DARK, leading=13)),
            Paragraph("⚡  FASTAPI", ParagraphStyle('', fontName='Helvetica-Bold', fontSize=10, textColor=DARK, leading=13)),
            Paragraph("🛡️  PYDANTIC", ParagraphStyle('', fontName='Helvetica-Bold', fontSize=10, textColor=DARK, leading=13)),
        ],
        [
            Paragraph("Tutto il mondo AI parla Python prima di qualsiasi altro linguaggio. "
                      "Anthropic, OpenAI, Google — tutti i loro strumenti arrivano qui per primi. "
                      "Usare un altro linguaggio significa lavorare sempre un passo indietro.",
                ParagraphStyle('', fontName='Helvetica', fontSize=9, textColor=HexColor('#444'), leading=14)),
            Paragraph("Il server che riceve le richieste dal frontend e risponde. "
                      "Veloce da scrivere, veloce in esecuzione. Genera automaticamente la documentazione. "
                      "Usato in produzione da Netflix, Uber, Microsoft.",
                ParagraphStyle('', fontName='Helvetica', fontSize=9, textColor=HexColor('#444'), leading=14)),
            Paragraph("Il guardiano dei dati. Ogni informazione che entra nel sistema viene "
                      "controllata automaticamente. Se manca qualcosa o arriva nel formato sbagliato, "
                      "il sistema lo dice subito — prima che il problema si nasconda.",
                ParagraphStyle('', fontName='Helvetica', fontSize=9, textColor=HexColor('#444'), leading=14)),
        ],
    ]
    stack_tbl = Table(stack_data, colWidths=[CW/3, CW/3, CW/3])
    stack_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0), DARK),
        ('BACKGROUND',    (0,1), (-1,1), OFFWHITE),
        ('TEXTCOLOR',     (0,0), (-1,0), WHITE),
        ('BOX',           (0,0), (-1,-1), 0.5, HexColor('#DDD')),
        ('INNERGRID',     (0,0), (-1,-1), 0.5, HexColor('#E8E8E8')),
        ('TOPPADDING',    (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING',   (0,0), (-1,-1), 12),
        ('RIGHTPADDING',  (0,0), (-1,-1), 12),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(stack_tbl)
    story.append(divider())

    # ── SEZ 3: LA STRUTTURA ────────────────────────────────────
    story.append(Paragraph("L'ARCHITETTURA", S['label']))
    story.append(Paragraph("Come è organizzato il sistema.", S['h2']))
    story.append(Paragraph(
        "Il sistema è diviso in strati. Ogni strato sa solo cosa c'è direttamente sopra "
        "e sotto di lui. Non salta livelli, non tocca quello che non lo riguarda.",
        S['body']))
    story.append(Spacer(1, 8))

    strati = [
        ("Strato 1", "Il Server",
         "Riceve le richieste dal mondo esterno — dall'app BRAVO, dal browser, da qualsiasi client. "
         "Non sa niente di AI, di database, di immagini. "
         "Sa solo chi ha bussato e cosa ha chiesto — e smista la richiesta allo strato giusto."),
        ("Strato 2", "Gli Agenti",
         "Qui vive l'intelligenza del sistema. C'è un orchestratore che decide quale agente chiamare. "
         "C'è l'agente content che parla con Claude e genera il copy. "
         "C'è l'agente designer che compone le immagini. Ognuno fa solo la sua parte."),
        ("Strato 3", "I Modelli",
         "Qui si definisce la forma di ogni oggetto del sistema. Cos'è una richiesta? Cos'è un post? "
         "Cos'è un feedback? Ogni oggetto ha i suoi campi e i suoi tipi. "
         "Se arriva qualcosa di sbagliato, il sistema lo blocca immediatamente."),
        ("Strato 4", "Gli Strumenti",
         "Sono le 'mani' del sistema: il modulo che salva e aggrega il feedback, "
         "quello che chiama i servizi esterni per le immagini, quello che gestisce la pipeline condivisa. "
         "Gli agenti li usano, ma non sanno come funzionano dentro. Sono intercambiabili."),
        ("Strato 5", "I Prompt",
         "Qui vivono le istruzioni che vengono date all'AI per ogni cliente. "
         "DaKady ha il suo. Un domani un altro brand avrà il suo. "
         "Aggiungere un nuovo cliente significa aggiungere un solo file — nient'altro si tocca."),
    ]

    strati_rows = []
    for who, what, body in strati:
        strati_rows.append([
            Paragraph(who, S['step_who']),
            Paragraph(what, S['step_what']),
            Paragraph(body, S['step_body']),
        ])

    strati_tbl = Table(strati_rows, colWidths=[22*mm, 32*mm, CW - 54*mm])
    strati_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), OFFWHITE),
        ('ROWBACKGROUNDS',(0,0), (-1,-1), [WHITE, HexColor('#F8F8F8')]),
        ('BOX',           (0,0), (-1,-1), 0.5, HexColor('#DDD')),
        ('INNERGRID',     (0,0), (-1,-1), 0.5, HexColor('#EBEBEB')),
        ('TOPPADDING',    (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('RIGHTPADDING',  (0,0), (-1,-1), 10),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
        ('LINEBEFORE',    (0,0), (0,-1), 2, RED),
    ]))
    story.append(strati_tbl)
    story.append(divider())

    # ── SEZ 4: FEEDBACK LOOP ───────────────────────────────────
    story.append(Paragraph("IL CUORE DEL SISTEMA", S['label']))
    story.append(Paragraph("Il sistema che impara da solo.", S['h2']))
    story.append(Paragraph(
        "Questa è la differenza tra un generatore di testo e un assistente intelligente. "
        "Un generatore produce sempre lo stesso output. "
        "Un assistente migliora ogni volta che riceve una risposta dall'utente.",
        S['body']))
    story.append(Spacer(1, 8))

    loop_steps = [
        ("Giorno 1",    "Il sistema genera",
         "L'AI genera 5 post per DaKady. Non sa ancora molto sulle preferenze del brand — "
         "lavora con le istruzioni di base e il contesto della settimana. I risultati sono buoni, ma generici."),
        ("Giorno 1",    "BRAVO valuta",
         "Il team sceglie il post migliore e approva — indicando cosa ha funzionato. "
         "Se ne rifiuta uno, scrive il motivo: 'Tono troppo formale' oppure 'Headline troppo lunga'. "
         "Questo feedback viene salvato automaticamente nel sistema."),
        ("Giorno 7",    "Il sistema ricorda",
         "Alla prossima generazione, il sistema legge i feedback passati, li aggrega in pattern "
         "e li inietta nel prompt prima di chiamare Claude. "
         "'Questo layout è stato rifiutato 4 volte. Quest'altro approvato 6 volte.' "
         "Claude genera tenendo conto di ciò che ha funzionato."),
        ("Settimana 4", "Il sistema conosce il brand",
         "Dopo un mese, il sistema ha accumulato decine di segnali. "
         "Genera contenuti sempre più coerenti con il tono di DaKady. "
         "Il miglioramento è automatico, progressivo e permanente."),
    ]

    loop_rows = []
    for when, what, body in loop_steps:
        loop_rows.append([
            Paragraph(when,  S['step_who']),
            Paragraph(what,  S['step_what']),
            Paragraph(body,  S['step_body']),
        ])

    loop_tbl = Table(loop_rows, colWidths=[24*mm, 34*mm, CW - 58*mm])
    loop_tbl.setStyle(TableStyle([
        ('ROWBACKGROUNDS',(0,0), (-1,-1), [WHITE, HexColor('#F8F8F8')]),
        ('BOX',           (0,0), (-1,-1), 0.5, HexColor('#DDD')),
        ('INNERGRID',     (0,0), (-1,-1), 0.5, HexColor('#EBEBEB')),
        ('TOPPADDING',    (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('RIGHTPADDING',  (0,0), (-1,-1), 10),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
        ('LINEBEFORE',    (0,0), (0,-1), 2, RED),
    ]))
    story.append(loop_tbl)
    story.append(Spacer(1, 10))

    hl2_data = [[
        [
            Paragraph("PERCHÉ QUESTO È STRATEGICO PER BRAVO", S['highlight_label']),
            Paragraph(
                "Ogni cliente di BRAVO ha un tono diverso, un pubblico diverso, un modo di comunicare diverso. "
                "Il sistema di feedback permette all'AI di imparare queste differenze da sola — automaticamente — "
                "senza intervento manuale su prompt o codice. "
                "Dopo 30 giorni, il sistema genera per DaKady come se lo conoscesse da anni. "
                "Questo non è possibile con nessun tool off-the-shelf. "
                "È un vantaggio competitivo reale che BRAVO porta ai propri clienti.",
                S['highlight']),
        ]
    ]]
    hl2_tbl = Table(hl2_data[0], colWidths=[CW])
    hl2_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), HexColor('#FEF9F9')),
        ('LEFTPADDING',  (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('TOPPADDING',   (0,0), (-1,-1), 12),
        ('BOTTOMPADDING',(0,0), (-1,-1), 12),
        ('LINEBEFORE',   (0,0), (0,-1), 3, RED),
        ('BOX',          (0,0), (-1,-1), 0.5, HexColor('#F5C6C2')),
    ]))
    story.append(hl2_tbl)
    story.append(divider())

    # ── SEZ 5: LE REGOLE ───────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("LE REGOLE DEL GIOCO", S['label']))
    story.append(Paragraph("5 regole per non ritrovarsi nei guai.", S['h2']))
    story.append(Paragraph(
        "Queste non sono opinioni. Sono le regole che separano i sistemi che durano anni "
        "da quelli che si riscrivono da zero ogni 6 mesi. "
        "Valgono per il nostro backend. Valgono per quello di BRAVO. Valgono per qualsiasi applicazione seria.",
        S['body']))
    story.append(Spacer(1, 8))

    regole = [
        ("01", "Un file, una responsabilità",
         "Il file che genera il testo non salva nel database. Il file che salva nel database non chiama l'AI. "
         "Il file che chiama l'AI non sa niente di immagini. "
         "Quando tutto sta nel posto giusto, cercare un bug diventa banale — sai già dove guardare. "
         "Quando tutto è mescolato, diventa un'archeologia."),
        ("02", "I dati hanno una forma fissa",
         "Ogni oggetto del sistema — una richiesta, una risposta, un feedback — "
         "ha una forma precisa e dichiarata in anticipo. "
         "Se arriva qualcosa fuori forma, il sistema lo dice immediatamente con un errore chiaro. "
         "Non lascia passare dati sbagliati che si manifestano come problemi misteriosi tre step dopo."),
        ("03", "Le chiavi non vanno mai nel codice",
         "Chiavi API, password, URL di database — questi dati non toccano mai il codice sorgente. "
         "Vivono in un file separato che non viene mai condiviso, mai caricato su GitHub, mai spedito per email. "
         "Una chiave nel codice è come lasciare le chiavi di casa nel lucchetto. Prima o poi qualcuno le trova."),
        ("04", "Gli errori si nominano, non si nascondono",
         "Quando qualcosa va storto — l'AI non risponde, un servizio esterno ha un timeout, "
         "arriva un dato malformato — il sistema non finge che vada tutto bene. "
         "Registra l'errore, lo comunica chiaramente, e gestisce il caso senza bloccare l'intera richiesta. "
         "Il silenzio è il peggior nemico di chi deve risolvere un problema."),
        ("05", "Il feedback è carburante, non optional",
         "Ogni approvazione, ogni rifiuto, ogni modifica fatta dall'utente deve essere registrata nel sistema. "
         "Non per statistiche. Per miglioramento reale e progressivo. "
         "Un sistema AI senza feedback è un motore senza carburante — gira, ma non va da nessuna parte. "
         "Più feedback entra, più il sistema diventa preciso."),
    ]

    for num, title, body in regole:
        row = Table([[
            Paragraph(num, S['rule_num']),
            [Paragraph(title, S['rule_title']), Spacer(1,3), Paragraph(body, S['rule_body'])],
        ]], colWidths=[14*mm, CW - 14*mm])
        row.setStyle(TableStyle([
            ('VALIGN',        (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING',    (0,0), (-1,-1), 10),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
            ('LEFTPADDING',   (0,0), (-1,-1), 0),
            ('RIGHTPADDING',  (0,0), (-1,-1), 0),
        ]))
        wrapper = Table([[row]], colWidths=[CW])
        wrapper.setStyle(TableStyle([
            ('BACKGROUND',   (0,0), (-1,-1), OFFWHITE),
            ('BOX',          (0,0), (-1,-1), 0.5, HexColor('#DDD')),
            ('TOPPADDING',   (0,0), (-1,-1), 0),
            ('BOTTOMPADDING',(0,0), (-1,-1), 0),
            ('LEFTPADDING',  (0,0), (-1,-1), 14),
            ('RIGHTPADDING', (0,0), (-1,-1), 14),
            ('LINEBEFORE',   (0,0), (0,-1), 3, RED),
        ]))
        story.append(KeepTogether([wrapper, Spacer(1, 4)]))

    story.append(divider())

    # ── SEZ 6: CHI FA COSA ─────────────────────────────────────
    story.append(Paragraph("CHI FA COSA", S['label']))
    story.append(Paragraph("La divisione perfetta tra i due sistemi.", S['h2']))
    story.append(Paragraph(
        "Il backend DaKady e l'applicazione BRAVO sono due sistemi distinti che collaborano. "
        "Ognuno eccelle nella sua area. Nessuno fa il lavoro dell'altro.",
        S['body']))
    story.append(Spacer(1, 8))

    P = lambda txt, st: Paragraph(txt, st)
    tbl_headers = [
        P("FUNZIONE", S['tbl_header']),
        P("CHI LA GESTISCE", S['tbl_header']),
        P("PERCHÉ QUI", S['tbl_header']),
    ]
    tbl_rows = [
        ["Generazione copy con AI (Claude)",      "Backend DaKady",  "Il prompt, il feedback loop, la memoria brand"],
        ["Composizione immagini (layout, logo)",  "Backend DaKady",  "Il designer agent è centralizzato e migliorabile in un punto"],
        ["Apprendimento dai feedback",            "Backend DaKady",  "La memoria di ogni brand vive qui, separata per cliente"],
        ["Autenticazione e gestione utenti",      "App BRAVO",       "BRAVO conosce i suoi utenti, ruoli, sessioni, piani"],
        ["Upload e storage foto",                 "App BRAVO",       "Lo storage appartiene all'infrastruttura BRAVO"],
        ["Database clienti e storico post",       "App BRAVO",       "Il CRM e la storicizzazione sono dati di business BRAVO"],
        ["Pubblicazione su Instagram / LinkedIn", "App BRAVO",       "I token OAuth dei social appartengono all'account BRAVO"],
        ["Interfaccia utente — review post",      "App BRAVO",       "Il frontend è il prodotto che vede il cliente finale"],
        ["Contesto settimanale (tema, angoli)",   "Entrambi",        "BRAVO lo raccoglie e lo invia — DaKady lo usa per generare"],
    ]

    PILL_COLOR = {
        "Backend DaKady": (BLUE, HexColor('#EBF5FB')),
        "App BRAVO":       (GREEN, HexColor('#EAFAF1')),
        "Entrambi":        (ORANGE, HexColor('#FEF9E7')),
    }

    formatted = [tbl_headers]
    for func, who, why in tbl_rows:
        color, bg = PILL_COLOR[who]
        pill_style = ParagraphStyle('p', fontName='Helvetica-Bold', fontSize=8,
                                    textColor=color, leading=11)
        formatted.append([
            P(func, S['tbl_cell_bold']),
            P(who,  pill_style),
            P(why,  S['tbl_cell']),
        ])

    main_tbl = Table(formatted, colWidths=[55*mm, 32*mm, CW - 87*mm])
    ts = TableStyle([
        ('BACKGROUND',    (0,0), (-1,0), DARK),
        ('TEXTCOLOR',     (0,0), (-1,0), WHITE),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [WHITE, HexColor('#F8F8F8')]),
        ('BOX',           (0,0), (-1,-1), 0.5, HexColor('#CCC')),
        ('INNERGRID',     (0,0), (-1,-1), 0.3, HexColor('#E0E0E0')),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('RIGHTPADDING',  (0,0), (-1,-1), 10),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
    ])
    # Evidenzia riga "Entrambi"
    for i, (_, who, _) in enumerate(tbl_rows):
        if who == "Entrambi":
            ts.add('BACKGROUND', (0, i+1), (-1, i+1), HexColor('#FFFDE7'))
    main_tbl.setStyle(ts)
    story.append(main_tbl)
    story.append(Spacer(1, 10))

    hl3_tbl = Table([[
        [
            Paragraph("IL PUNTO DI CONNESSIONE TRA I DUE SISTEMI", S['highlight_label']),
            Paragraph(
                "Il backend DaKady espone verso BRAVO due soli punti di contatto. "
                "Il primo: BRAVO manda foto, brief e contesto — riceve 5 post pronti. "
                "Il secondo: BRAVO manda il feedback dell'utente (approvato/rifiutato) — "
                "il sistema lo registra e migliora la prossima generazione. "
                "Tutto il resto è invisibile. Questa separazione è intenzionale — "
                "è quello che permette a entrambi di crescere senza dipendere l'uno dall'altro.",
                S['highlight']),
        ]
    ]], colWidths=[CW])
    hl3_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), HexColor('#FEF9F9')),
        ('LEFTPADDING',  (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('TOPPADDING',   (0,0), (-1,-1), 12),
        ('BOTTOMPADDING',(0,0), (-1,-1), 12),
        ('LINEBEFORE',   (0,0), (0,-1), 3, RED),
        ('BOX',          (0,0), (-1,-1), 0.5, HexColor('#F5C6C2')),
    ]))
    story.append(hl3_tbl)
    story.append(divider())

    # ── SEZ 7: PROSSIMI PASSI ─────────────────────────────────
    story.append(Paragraph("PROSSIMI PASSI", S['label']))
    story.append(Paragraph("Da dove iniziare concretamente.", S['h2']))
    story.append(Paragraph(
        "Il sistema backend esiste, funziona ed è stato costruito seguendo esattamente questi principi. "
        "La priorità ora è connettere i due mondi nel modo corretto fin dall'inizio — "
        "senza scorciatoie che si trasformano in debiti tecnici da pagare in futuro.",
        S['body']))
    story.append(Spacer(1, 8))

    passi = [
        ("01", "API Reference",
         "Consegniamo a BRAVO la documentazione completa dei due punti di contatto: "
         "quali informazioni mandare, in quale formato, cosa aspettarsi in risposta. "
         "I loro sviluppatori non devono indovinare niente — trovano tutto scritto."),
        ("02", "Schema database",
         "Definiamo insieme le tabelle minime che BRAVO deve creare nella loro applicazione: "
         "contesti settimanali, foto, post generati, feedback utente. "
         "Uno schema chiaro e condiviso evita incomprensioni e migrazioni dolorose."),
        ("03", "Ambiente di test",
         "BRAVO deve poter testare l'integrazione senza consumare quota reale delle API durante lo sviluppo. "
         "Mettiamo a disposizione un ambiente di staging con risposte simulate — "
         "così possono costruire e testare liberamente."),
    ]

    passi_rows = []
    for num, title, body in passi:
        passi_rows.append([
            Paragraph(num, S['rule_num']),
            [Paragraph(title, S['rule_title']), Spacer(1,3), Paragraph(body, S['rule_body'])],
        ])

    passi_tbl = Table(passi_rows, colWidths=[14*mm, CW - 14*mm])
    passi_tbl.setStyle(TableStyle([
        ('ROWBACKGROUNDS',(0,0), (-1,-1), [WHITE, HexColor('#F8F8F8')]),
        ('BOX',          (0,0), (-1,-1), 0.5, HexColor('#DDD')),
        ('INNERGRID',    (0,0), (-1,-1), 0.3, HexColor('#EBEBEB')),
        ('TOPPADDING',   (0,0), (-1,-1), 10),
        ('BOTTOMPADDING',(0,0), (-1,-1), 10),
        ('LEFTPADDING',  (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('VALIGN',       (0,0), (-1,-1), 'TOP'),
        ('LINEBEFORE',   (0,0), (0,-1), 2, RED),
    ]))
    story.append(passi_tbl)

    # ── BUILD ───────────────────────────────────────────────────
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"✅ PDF generato: {OUTPUT}")


if __name__ == "__main__":
    build()
