# Legal – Jouw Voorleesboekje

Overzicht van juridische documenten voor [jouwvoorleesboekje.nl](https://jouwvoorleesboekje.nl).

**Versiedatum alle documenten:** 19 april 2026 (versie 0.1 DRAFT)  
**Status:** Concept – nog niet klaar voor livegang. Zie onderstaande actielijst.

---

## Opgestelde documenten

| Bestand | Beschrijving | Status |
|---|---|---|
| [`privacyverklaring.md`](./privacyverklaring.md) | Privacyverklaring voor bezoekers en kopers, conform AVG art. 13/14. Beschrijft welke gegevens worden verwerkt, op welke grondslag, hoe lang, door wie en welke rechten betrokkenen hebben. | DRAFT |
| [`algemene-voorwaarden.md`](./algemene-voorwaarden.md) | Algemene voorwaarden voor consumenten. Inclusief herroepingsrecht bij digitale inhoud (art. 6:230p BW), kwaliteitsgarantie, AI-disclaimer en aansprakelijkheidsbeperking. | DRAFT |
| [`verwerkersovereenkomst-template.md`](./verwerkersovereenkomst-template.md) | Template verwerkersovereenkomst op basis van art. 28 AVG. Te gebruiken bij het afsluiten van overeenkomsten met OpenAI, Mollie, Resend en toekomstige verwerkers. | DRAFT – invulvelden aanwezig |

---

## Wat moet er nog gebeuren vóór livegang?

### 1. Jurist-review (verplicht)

> Alle drie documenten zijn opgesteld door een AI-assistent en zijn **nog niet gevalideerd door een jurist**. Laat een AVG- en/of IT-jurist de volgende punten controleren:

- **Privacyverklaring**
  - Correctheid van de gekozen verwerkingsgrondslag (uitvoering overeenkomst, art. 6 lid 1 sub b AVG)
  - Bewaartermijnen (72 uur voor kindgegevens, 7 jaar factuurgegevens)
  - Formulering rondom kindergegevens en parental consent
  - Doorgiftegrondslag naar VS (SCC's en/of EU-US DPF) per verwerker

- **Algemene Voorwaarden**
  - Formulering herroepingsrecht bij digitale inhoud (art. 6:230p BW) – dit is een kwetsbaar punt; de expliciete verklaring van de koper moet technisch correct worden geïmplementeerd in het bestelproces
  - Toereikendheid van de kwaliteitsgarantie
  - Aansprakelijkheidsbeperking

- **Verwerkersovereenkomst-template**
  - Selectie van het juiste SCC-module per verwerker (C2P voor controller-to-processor)
  - Aansprakelijkheidsartikel
  - Auditrechten tegenover grote platforms

### 2. Verwerkersovereenkomsten afsluiten met verwerkers

Jouw Voorleesboekje moet met elk van de volgende verwerkers een getekende verwerkersovereenkomst hebben:

| Verwerker | Notitie |
|---|---|
| **OpenAI** | OpenAI biedt een eigen DPA aan via [platform.openai.com/docs/guides/data-security-privacy](https://platform.openai.com/docs/guides/data-security-privacy). Controleer of deze DPA voldoet aan art. 28 AVG; vul dit template aan als dat nodig is. Let op: standaard API-gebruik vs. zero data retention (ZDR) instelling. |
| **Mollie** | Mollie B.V. (NL) heeft een eigen verwerkersovereenkomst beschikbaar in het Mollie Dashboard. Mollie is voor de eigenlijke betaaldata verwerkingsverantwoordelijke; voor overige gegevens verwerker. Zie [mollie.com/en/privacy](https://www.mollie.com/en/privacy). |
| **Resend** | Resend biedt een DPA aan via [resend.com/legal/dpa](https://resend.com/legal/dpa). Controleer op volledigheid en doorgiftegrondslag. |
| **Hostingprovider** | Nog te kiezen. Zorg dat de hostingprovider een DPA biedt vóór livegang. Bij voorkeur een EER-gebaseerde partij. |

### 3. DPIA overwegen

Een Data Protection Impact Assessment (DPIA) is verplicht wanneer verwerking "waarschijnlijk een hoog risico inhoudt" (art. 35 AVG). Relevante risicofactoren voor Jouw Voorleesboekje:

- Verwerking van gegevens over kinderen (kwetsbare groep)
- Gebruik van AI voor gegenereerde inhoud
- Doorgifte van persoonsgegevens naar de VS

De Autoriteit Persoonsgegevens heeft een [DPIA-tool beschikbaar](https://www.autoriteitpersoonsgegevens.nl/nl/onderwerpen/avg-algemeen/dpia). Laat een jurist beoordelen of een formele DPIA verplicht is.

### 4. Technische implementatie in het bestelproces

- Zorg dat het herroepingsrecht-formulier in het bestelproces juridisch correct is geïmplementeerd: de koper moet actief akkoord geven, met een duidelijke tekst conform de wettelijke vereisten.
- Zorg voor automatische verwijdering van kindgegevens na 72 uur en van de PDF na 30 dagen (technische implementatie in de backend).
- Controleer de cookie-instellingen: alleen functionele cookies, geen tracking.

### 5. Publicatie op de website

- Publiceer de privacyverklaring en de algemene voorwaarden op een vaste URL (bijv. `/privacyverklaring` en `/algemene-voorwaarden`).
- Link vanuit de footer van elke pagina naar beide documenten.
- Verwijs naar beide documenten in het bestelproces, met een verplicht vinkje voor de algemene voorwaarden.

---

## Referentiebronnen

| Organisatie | Document | URL |
|---|---|---|
| Autoriteit Persoonsgegevens | Privacywetgeving voor organisaties | [autoriteitpersoonsgegevens.nl/nl/onderwerpen/avg-algemeen](https://www.autoriteitpersoonsgegevens.nl/nl/onderwerpen/avg-algemeen) |
| Autoriteit Persoonsgegevens | DPIA-tool en richtsnoeren | [autoriteitpersoonsgegevens.nl/nl/onderwerpen/avg-algemeen/dpia](https://www.autoriteitpersoonsgegevens.nl/nl/onderwerpen/avg-algemeen/dpia) |
| Europese Commissie | Standard Contractual Clauses (2021) | [commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) |
| Europese Commissie | EU-US Data Privacy Framework | [commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en](https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en) |
| EDPB | Richtsnoeren verwerkersovereenkomsten (art. 28 AVG) | [edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072020-concepts-controller-and-processor_en](https://edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072020-concepts-controller-and-processor_en) |
| ICTRecht | Gratis modelcontracten en templates | [ictrecht.nl](https://www.ictrecht.nl) |
| Thuiswinkel.org | Modellen en voorwaarden voor webwinkels | [thuiswinkel.org](https://www.thuiswinkel.org) |
| Consumentenautoriteit / ACM | Regels digitale inhoud en herroepingsrecht | [acm.nl/nl/onderwerpen/telecommunicatie/internet/online-kopen](https://www.acm.nl/nl/onderwerpen/telecommunicatie/internet/online-kopen) |

---

*Alle documenten in deze map zijn opgesteld door een AI-assistent op basis van algemene informatie. Voor definitieve livegang is validatie door een AVG/IT-jurist aanbevolen.*
