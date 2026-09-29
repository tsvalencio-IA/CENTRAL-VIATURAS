const sharp = require('sharp');

function cleanPlate(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function xml(value) {
  return String(value || '').replace(/[<>&"']/g, (ch) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;'
  }[ch]));
}

module.exports = async function handler(req, res) {
  const plate = cleanPlate(req.query.placa);
  if (!plate) {
    res.status(400).send('Placa inválida.');
    return;
  }

  const p = xml(plate);
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#08111b"/>
        <stop offset="100%" stop-color="#13283b"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#1699ef"/>
        <stop offset="100%" stop-color="#37d67a"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#000000" flood-opacity="0.35"/>
      </filter>
    </defs>

    <rect width="1200" height="630" rx="0" fill="url(#bg)"/>
    <circle cx="1100" cy="80" r="220" fill="#2ca7ff" opacity="0.06"/>
    <circle cx="80" cy="590" r="240" fill="#37d67a" opacity="0.05"/>

    <text x="80" y="90" fill="#8ea0b5" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="700">CENTRAL DE VIATURAS</text>
    <rect x="80" y="130" width="1040" height="330" rx="42" fill="#0f1b28" stroke="#2b4257" stroke-width="3" filter="url(#shadow)"/>

    <text x="600" y="225" text-anchor="middle" fill="#8ea0b5" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="700">VIATURA</text>
    <rect x="250" y="260" width="700" height="130" rx="22" fill="#f8fafc" stroke="url(#accent)" stroke-width="6"/>
    <text x="600" y="347" text-anchor="middle" fill="#0a1622" font-size="78" font-family="Arial, Helvetica, sans-serif" font-weight="900" letter-spacing="6">${p}</text>

    <rect x="370" y="500" width="460" height="72" rx="20" fill="#2ca7ff"/>
    <text x="600" y="547" text-anchor="middle" fill="#06131d" font-size="27" font-family="Arial, Helvetica, sans-serif" font-weight="900">ABRIR VIATURA</text>

    <text x="80" y="594" fill="#72869a" font-size="18" font-family="Arial, Helvetica, sans-serif">Powered by thIAguinho Soluções Digitais</text>
  </svg>`;

  try {
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).send(png);
  } catch (error) {
    console.error(error);
    res.status(500).send('Falha ao gerar prévia.');
  }
};
