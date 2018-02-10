var express = require('express');
var router = express.Router();


module.exports = function(db) {
  router.get('/', function(req, res, next) {
    var message = new Array(req.flash('loginMessage')[0])
    res.render('login', { title: 'Login Page', message: message } );
  });

  router.post('/', function(req, res, next) {
    db.query(`SELECT * FROM users WHERE email = '${req.body.email}'`, (err, data) => {
      if(err) {
        console.error(err);
        req.flash('loginMessage', 'something wrong please call administrator');
        return res.redirect('/')
      }
      if(data.rows.length > 0) {
        //login masuk
        if(req.body.pass, data.rows[0].password) {
          delete data.rows[0].password;
          req.session.user = data.rows[0]
          return res.redirect('/projects')
        } else {
          req.flash('loginMessage', 'password is not match');
          return res.redirect('/')
        }

      } else {
        req.flash('loginMessage', "email is not exist")
        return res.redirect('/')
      }
    });
  });

  router.get('/register', function(req, res, next) {
    var message = new Array(req.flash('registerMessage')[0])
    res.render('register', { title: 'Register Account', message: message } );
  });

  router.post('/register', function(req, res, next) {
    if(req.body.pass !== req.body.repass) {
      req.flash('registerMessage', 'password is not match');
      return res.redirect('/register')
    }


    db.query(`SELECT email FROM users WHERE email = '${req.body.email}'`, (err, data) => {
      if(err) {
        console.error(err);
        req.flash('registerMessage', 'something wrong please call administrator');
        return res.redirect('/register')
      }
      console.log(data);
      if(data.rows.length > 0) {
        req.flash('registerMessage', 'email already registered');
        return res.redirect('/register')
      } else {
        db.query(`INSERT INTO users(email, password, projectcolumns, membercolumns, issuescolumns, privilege) VALUES('${req.body.email}', '${req.body.pass}', '{}', '{}', '{}', 'User')`, (err, data) => {
          if(err) {
            console.error(err);
            req.flash('registerMessage', 'something wrong please call administrator');
            return res.redirect('/register')
          }
          req.flash('registerMessage', 'registration successful, please log into your account');
          return res.redirect('/register')
        });
      }
    });
  });

  router.get('/logout', function(req, res, next) {
    req.session.destroy(function() {
      res.redirect('/');
    });
  });

  return router;
}
/* GET home page. */
