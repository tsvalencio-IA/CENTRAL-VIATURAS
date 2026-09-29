const sharp = require('sharp');
function cleanPlate(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}
function xml(value) {
  return String(value || '').replace(/[<>&"']/g, ch => ({
    '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'
  }[ch]));
}
module.exports = async function handler(req, res) {
  const plate = cleanPlate(req.query.placa);
  if (!plate) return res.status(400).send('Placa inválida.');
  const p = xml(plate);
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#06111b"/>
      <stop offset="100%" stop-color="#10283b"/>
    </linearGradient>
    <linearGradient id="plateStroke" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#20a7ff"/>
      <stop offset="100%" stop-color="#39d98a"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#000000" flood-opacity=".38"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1040" cy="30" r="250" fill="#20a7ff" opacity=".055"/>
  <circle cx="150" cy="650" r="280" fill="#39d98a" opacity=".04"/>

  <!-- Faixa externa: útil quando o WhatsApp mostra a imagem inteira no mobile -->
  <text x="70" y="82" fill="#9db0c3" font-size="27" font-family="Arial,Helvetica,sans-serif" font-weight="700">CENTRAL DE VIATURAS</text>
  <text x="1130" y="82" text-anchor="end" fill="#6f8598" font-size="20" font-family="Arial,Helvetica,sans-serif" font-weight="700">ACOMPANHAMENTO</text>

  <!-- Área segura central: tudo importante cabe no recorte quadrado do WhatsApp Desktop -->
  <g transform="translate(300 72)">
    <rect x="0" y="0" width="600" height="486" rx="44" fill="#0d1b28" stroke="#263f54" stroke-width="3" filter="url(#shadow)"/>
    <rect x="42" y="38" width="516" height="58" rx="18" fill="#132838"/>
    <text x="300" y="77" text-anchor="middle" fill="#dce8f3" font-size="24" font-family="Arial,Helvetica,sans-serif" font-weight="800">VIATURA</text>

    <rect x="48" y="128" width="504" height="190" rx="28" fill="#f7fbff" stroke="url(#plateStroke)" stroke-width="7"/>
    <rect x="48" y="128" width="504" height="34" rx="22" fill="#e9f5ff"/>
    <text x="300" y="152" text-anchor="middle" fill="#2d6fa3" font-size="15" font-family="Arial,Helvetica,sans-serif" font-weight="900" letter-spacing="2">BRASIL • CENTRAL</text>
    <text x="300" y="264" text-anchor="middle" fill="#07131e" font-size="86" font-family="Arial,Helvetica,sans-serif" font-weight="900" letter-spacing="5">${p}</text>

    <rect x="84" y="354" width="432" height="72" rx="22" fill="#20a7ff"/>
    <text x="300" y="401" text-anchor="middle" fill="#04111b" font-size="28" font-family="Arial,Helvetica,sans-serif" font-weight="900">ABRIR VIATURA</text>
  </g>

  <text x="70" y="600" fill="#72879a" font-size="17" font-family="Arial,Helvetica,sans-serif">Powered by thIAguinho Soluções Digitais</text>
  </svg>`
  try {
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.setHeader('Content-Type','image/png');
    res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(png);
  } catch (e) {
    console.error(e);
    res.status(500).send('Falha ao gerar prévia.');
  }
};
