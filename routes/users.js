"use strict";
const express = require('express');
const router = express.Router();
const userChecker = require('../helper/userchecker')


module.exports = function(db) {
  /* GET users listing. */
  router.get('/', function(req, res, next) {
    console.log("router(/projects), method(get), req.session: ");
    console.log(req.session);
    res.send('respond with a resource');
  });

  router.get('/profile', userChecker, function(req, res, next) {
    console.log("router(/profile), method(get), req.session: ");
    console.log(req.session);
    res.render('users/profile', {
      title: "user profile",
      page: "profile",
      userData: req.session.user,
      userSession: req.session.user
    });
  });

  router.post('/profile', userChecker, function(req, res) {
    console.log("masuk");
    console.log("router(/profile), method(post), req.body: ");
    console.log(req.body);
    let email = req.body.email;
    let password = req.body.password;
    let firstName = req.body.firstname;
    let lastName = req.body.lastname;
    let role = req.body.role;
    let isFullTime = (req.body.isfulltime ? true : false);
    let sqlQuery = '';
    console.log("isfulltime:", isFullTime);
    console.log("password:", password);
    if(req.body.password) {
      sqlQuery = `UPDATE users SET password = '${password}', firstname = '${firstName}',
      lastname = '${lastName}', role = '${role}', isfulltime = ${isFullTime} WHERE
      email = '${email}'`;
      db.query(sqlQuery);
      res.redirect('/projects')
    } else {
      sqlQuery = `UPDATE users SET firstname = '${firstName}',
      lastname = '${lastName}', role = '${role}', isfulltime = ${isFullTime} WHERE
      email = '${email}'`;
      db.query(sqlQuery);
      res.redirect('/projects')
    }
  });
  return router;
}
