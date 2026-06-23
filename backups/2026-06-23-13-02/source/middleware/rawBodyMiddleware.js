/**
 * Middleware для захвата сырого тела запроса
 * Необходимо для верификации webhook подписи CloudPayments
 */
function rawBodyMiddleware(req, res, next) {
  let data = '';
  
  req.on('data', (chunk) => {
    data += chunk;
  });
  
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
  
  req.on('error', (err) => {
    console.error('[RAW BODY MIDDLEWARE] Error:', err);
    next(err);
  });
}

module.exports = rawBodyMiddleware;
