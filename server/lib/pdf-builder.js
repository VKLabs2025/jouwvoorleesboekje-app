// PDF-compositor voor A5 voorleesboekje
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

// A5 landscape voor kijkboek: 595.28 x 419.53 punten
const A5_LANDSCAPE = { width: 595.28, height: 419.53 };
const COLORS = {
  ink: '#1E2A4A',
  cream: '#FFF8F0',
  apricot: '#FFB996',
  sage: '#8FBF9F',
  dust: '#7A8BB0',
};

export async function buildPdf({ order, story, characterSheet, imagesDir, outPath }) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [A5_LANDSCAPE.width, A5_LANDSCAPE.height],
      margin: 0,
      info: {
        Title: story.title,
        Author: 'Jouw Voorleesboekje',
        Subject: `Een persoonlijk voorleesboekje voor ${order.childFirstName}`,
        Keywords: 'kinderen, voorlezen, personaliseren',
      },
    });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);
    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);

    const W = A5_LANDSCAPE.width;
    const H = A5_LANDSCAPE.height;

    // ---- COVER (single full-bleed illustration) ----
    const coverPath = path.join(imagesDir, 'cover.png');
    doc.rect(0, 0, W, H).fill(COLORS.cream);
    if (fs.existsSync(coverPath)) {
      try {
        doc.image(coverPath, 0, 0, { width: W, height: H, fit: [W, H], align: 'center', valign: 'center' });
      } catch (e) {
        console.warn('[pdf] cover image fail:', e.message);
      }
    }
    // Titel-overlay met warm cream vlak
    const titleBlockH = 110;
    doc.save();
    doc.rect(0, 0, W, titleBlockH).fillOpacity(0.88).fill(COLORS.cream);
    doc.restore();
    doc.fillColor(COLORS.ink).fillOpacity(1);
    doc.font('Helvetica-Bold').fontSize(30).text(story.title, 40, 24, { width: W - 80, align: 'center' });
    doc.font('Helvetica-Oblique').fontSize(13).fillColor(COLORS.dust)
      .text(`Een voorleesboekje voor ${order.childFirstName}`, 40, 74, { width: W - 80, align: 'center' });

    // Onderbanner
    doc.save();
    doc.rect(0, H - 28, W, 28).fillOpacity(0.85).fill(COLORS.apricot);
    doc.restore();
    doc.fillColor(COLORS.ink).fillOpacity(1).font('Helvetica').fontSize(10)
      .text('jouwvoorleesboekje.nl', 0, H - 20, { width: W, align: 'center' });

    // ---- PAGES (links illustratie, rechts tekst) ----
    for (const page of story.pages) {
      doc.addPage({ size: [W, H], margin: 0 });
      doc.rect(0, 0, W, H).fill(COLORS.cream);

      const imgPath = path.join(imagesDir, `page-${page.pageNumber}.png`);
      const leftW = W / 2;
      const rightX = leftW;
      const rightW = W - leftW;
      const padding = 34;

      if (fs.existsSync(imgPath)) {
        try {
          doc.image(imgPath, 0, 0, { width: leftW, height: H, fit: [leftW, H], align: 'center', valign: 'center' });
        } catch (e) {
          console.warn(`[pdf] page-${page.pageNumber} image fail:`, e.message);
          doc.rect(0, 0, leftW, H).fill(COLORS.apricot);
        }
      } else {
        doc.rect(0, 0, leftW, H).fill(COLORS.apricot);
      }

      // Right: text
      doc.rect(rightX, 0, rightW, H).fill(COLORS.cream);
      doc.fillColor(COLORS.ink);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.dust)
        .text(`Pagina ${page.pageNumber}`, rightX + padding, padding, { width: rightW - 2 * padding });
      doc.moveDown(0.4);
      // Choose size based on amount of text
      const textLen = (page.text || '').length;
      const fontSize = textLen > 260 ? 13 : textLen > 180 ? 14 : 16;
      doc.font('Helvetica').fontSize(fontSize).fillColor(COLORS.ink)
        .text(page.text, rightX + padding, padding + 28, {
          width: rightW - 2 * padding,
          height: H - 2 * padding - 28,
          align: 'left',
          lineGap: 4,
        });

      // Decoratieve lijn onderin
      doc.strokeColor(COLORS.apricot).lineWidth(2)
        .moveTo(rightX + padding, H - padding).lineTo(W - padding, H - padding).stroke();
    }

    // ---- COLOFON ----
    doc.addPage({ size: [W, H], margin: 0 });
    doc.rect(0, 0, W, H).fill(COLORS.cream);
    const cx = 50;
    let cy = 44;
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(22)
      .text('Colofon', cx, cy);
    cy += 38;
    doc.font('Helvetica').fontSize(12).fillColor(COLORS.ink);

    const lines = [
      `Titel: ${story.title}`,
      `Voor: ${order.childFirstName}${order.childAge ? ` (${order.childAge} jaar)` : ''}`,
      `Thema: ${order.theme || '—'} · Toon: ${order.storyTone || '—'}`,
      `Illustratiestijl: ${order.illustrationStyle || 'warme-waterverf'}`,
      '',
      'Dit voorleesboekje is uniek gemaakt voor jou door Jouw Voorleesboekje.',
      'Verhaal en illustraties zijn met AI gegenereerd en automatisch gecontroleerd',
      'op kindveiligheid via moderation + Nederlandse blocklist.',
      '',
      'We bewaren kindgegevens maximaal 72 uur. Je PDF blijft 30 dagen beschikbaar.',
      'Vragen of opmerkingen? hallo@jouwvoorleesboekje.nl',
      '',
      `Order: ${order.id}`,
      `Besteld: ${new Date(order.createdAt).toLocaleString('nl-NL')}`,
      '',
      '© Jouw Voorleesboekje · jouwvoorleesboekje.nl',
    ];
    for (const l of lines) {
      doc.text(l, cx, cy, { width: W - 2 * cx });
      cy += 18;
    }

    doc.end();
  });
}
