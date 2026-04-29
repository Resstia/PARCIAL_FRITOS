const jwt = require('jsonwebtoken');

// Verifica que el request tenga un token JWT válido
function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
  }

  try {
    const usuario = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = usuario; // { username } disponible en la ruta
    next();
  } catch (e) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
}

module.exports = { verificarToken };
