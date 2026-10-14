// Draws a dining hall card onto a canvas so it can be copied or shared as a PNG.

const COLORS = {
    bg: '#111',
    card: '#1a1a1a',
    border: '#2a2a2a',
    text: '#e5e5e5',
    text2: '#999',
    text3: '#666',
    green: '#4ade80',
};
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const WIDTH = 520;
const PAD = 22;
const SCALE = 2;

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// sections: [{ label, stations: [{ name, items: [{ name, meta }] }] }]
// Runs the layout twice: once to measure the height, once to draw.
function layout(ctx, { hallName, subtitle, sections, emptyMessage }, draw) {
    const inner = WIDTH - PAD * 4;
    const left = PAD * 2;
    let y = PAD * 2;
    const text = (str, x, font, color, align = 'left') => {
        if (!draw) return;
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.fillText(str, x, y);
    };

    y += 20;
    text(hallName, left, `700 20px ${FONT}`, COLORS.text);
    text(subtitle, left + inner, `500 13px ${FONT}`, COLORS.text2, 'right');
    y += 14;
    if (draw) {
        ctx.fillStyle = COLORS.border;
        ctx.fillRect(left, y, inner, 1);
    }
    y += 8;

    if (!sections.length) {
        y += 24;
        text(emptyMessage, left, `400 14px ${FONT}`, COLORS.text3);
    }

    for (const section of sections) {
        if (section.label) {
            y += 26;
            text(section.label.toUpperCase(), left, `700 12px ${FONT}`, COLORS.green);
        }
        for (const station of section.stations) {
            y += 24;
            text(station.name.toUpperCase(), left, `600 11px ${FONT}`, COLORS.text3);
            y += 4;
            for (const item of station.items) {
                ctx.font = `500 12px ${FONT}`;
                const metaWidth = item.meta ? ctx.measureText(item.meta).width + 16 : 0;
                ctx.font = `400 15px ${FONT}`;
                const lines = wrapText(ctx, item.name, inner - metaWidth);
                lines.forEach((line, i) => {
                    y += i === 0 ? 24 : 20;
                    text(line, left, `400 15px ${FONT}`, COLORS.text);
                    if (i === 0 && item.meta) text(item.meta, left + inner, `500 12px ${FONT}`, COLORS.text2, 'right');
                });
            }
        }
    }

    y += 22;
    text('GMU Dining', left + inner, `500 11px ${FONT}`, COLORS.text3, 'right');
    return y + PAD * 2 - 6;
}

export function renderHallCardImage(card) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const height = layout(ctx, card, false);

    canvas.width = WIDTH * SCALE;
    canvas.height = height * SCALE;
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WIDTH, height);
    roundRect(ctx, PAD, PAD, WIDTH - PAD * 2, height - PAD * 2, 10);
    ctx.fillStyle = COLORS.card;
    ctx.fill();
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    layout(ctx, card, true);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create image'))), 'image/png');
    });
}

// Copies the image when the browser allows it, otherwise shares or downloads it.
// The blob promise goes straight into ClipboardItem so Safari keeps the tap as the user gesture.
export async function copyImage(blobPromise, fileName) {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
            return 'copied';
        } catch {
            // Fall through to share or download.
        }
    }

    const blob = await blobPromise;
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file] });
            return 'shared';
        } catch (err) {
            if (err.name === 'AbortError') return 'cancelled';
        }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
}
