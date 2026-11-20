const ImgPdf = (() => {
  const A4 = [595.28, 841.89];
  const MARGIN = 18;
  function toJpeg(file, rot = 0, max = 2200, quality = 0.86) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
        const turn = ((Number(rot) % 4) + 4) % 4, side = turn % 2 === 1;
        const cw = side ? h : w, ch = side ? w : h;
        const c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch);
        ctx.translate(cw / 2, ch / 2);
        ctx.rotate(turn * Math.PI / 2);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(async b => { if (!b) { reject(new Error('jpeg')); return; } resolve({ bytes: new Uint8Array(await b.arrayBuffer()), w: cw, h: ch }); }, 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }
  function layout(w, h) {
    const page = w > h ? [A4[1], A4[0]] : A4.slice();
    const s = Math.min((page[0] - MARGIN * 2) / w, (page[1] - MARGIN * 2) / h);
    const dw = w * s, dh = h * s;
    return { page, dw, dh, x: (page[0] - dw) / 2, y: (page[1] - dh) / 2 };
  }
  function build(images, title) {
    const enc = new TextEncoder();
    const parts = [];
    let length = 0;
    const offsets = [];
    const push = v => { const b = typeof v === 'string' ? enc.encode(v) : v; parts.push(b); length += b.length; };
    const n = v => (Math.round(v * 100) / 100).toString();
    const total = 2 + images.length * 3 + 1;
    const obj = (id, body) => { offsets[id] = length; push(id + ' 0 obj\n'); body(); push('\nendobj\n'); };
    push('%PDF-1.4\n');
    push(new Uint8Array([37, 226, 227, 207, 211, 10]));
    const kids = images.map((_, i) => (3 + i * 3) + ' 0 R').join(' ');
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push('<< /Type /Pages /Kids [' + kids + '] /Count ' + images.length + ' >>'));
    images.forEach((im, i) => {
      const id = 3 + i * 3;
      const L = layout(im.w, im.h);
      const content = 'q ' + n(L.dw) + ' 0 0 ' + n(L.dh) + ' ' + n(L.x) + ' ' + n(L.y) + ' cm /Im' + i + ' Do Q';
      obj(id, () => push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n(L.page[0]) + ' ' + n(L.page[1]) + '] /Resources << /XObject << /Im' + i + ' ' + (id + 2) + ' 0 R >> >> /Contents ' + (id + 1) + ' 0 R >>'));
      obj(id + 1, () => { push('<< /Length ' + enc.encode(content).length + ' >>\nstream\n'); push(content); push('\nendstream'); });
      obj(id + 2, () => { push('<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>\nstream\n'); push(im.bytes); push('\nendstream'); });
    });
    const info = total;
    const safe = String(title || 'Smart Chemistry').replace(/[^\x20-\x7E]/g, '').replace(/[()\\]/g, '').slice(0, 80) || 'Smart Chemistry';
    obj(info, () => push('<< /Producer (Smart Chemistry) /Title (' + safe + ') >>'));
    const xref = length;
    push('xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n');
    for (let i = 1; i <= total; i++) push(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    push('trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }
  return { toJpeg, build, layout };
})();
