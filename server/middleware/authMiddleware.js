function authorizeAdmin(req, res, next) {
  const user = req.body.user;

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
     
  next();
}

module.exports = { authorizeAdmin };

