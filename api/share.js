function cleanPlate(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

module.exports = function handler(req, res) {
  const plate = cleanPlate(req.query.placa);
  if (!plate) {
    res.status(400).send('Placa inválida.');
    return;
  }

  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers.host;
  const origin = `${proto}://${host}`;
  const target = `${origin}/v.html?${encodeURIComponent(plate)}`;
  const image = `${origin}/preview/${encodeURIComponent(plate)}`;
  const title = `🚙 ${plate}`;
  const description = 'ABRIR VIATURA • Central de Viaturas';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)} — Central de Viaturas</title>

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Central de Viaturas">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:secure_url" content="${esc(image)}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${esc(origin + '/p/' + plate)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">

  <meta http-equiv="refresh" content="0;url=${esc(target)}">
  <style>
    body{margin:0;background:#0b1118;color:#eef4fb;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}
    a{color:#2ca7ff;font-weight:800}
    div{text-align:center;padding:24px}
  </style>
</head>
<body>
  <div>
    <h1>${esc(plate)}</h1>
    <p>Abrindo acompanhamento da viatura…</p>
    <p><a href="${esc(target)}">ABRIR VIATURA</a></p>
  </div>
  <script>location.replace(${JSON.stringify(target)});</script>
</body>
</html>`);
};
