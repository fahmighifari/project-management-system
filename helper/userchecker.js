// const adminAccessUrl = ['/settings',"/projects/add" ]
module.exports = function(req, res, next) {
  if(req.session.user && req.session.user.userid) {
    return next();
  }
  res.redirect('/');
}
