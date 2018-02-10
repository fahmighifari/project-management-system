"use strict";
const express = require('express');
const router = express.Router();
const userChecker = require('../helper/userchecker')

module.exports = function(db) {

  router.get('/', userChecker, function(req, res) {
    if(req.session.user.privilege !== "Admin") {
        return res.redirect('/projects');
    }
    let sqlQuery = `SELECT * FROM users`
    db.query(sqlQuery, function(err, usersData) {
        res.render('settings/settings', {
            title: "Settings",
            page: "settings",
            userData: req.session.user,
            usersData: usersData.rows,
            userSession: req.session.user
        });
    });
  });

  router.post('/', userChecker, function(req, res) {
    let sqlQuery = `UPDATE users SET privilege = '${req.body.privilege}' WHERE userid = ${req.body.user}`
    console.log(sqlQuery);
    db.query(sqlQuery, function(err) {
      if(err) {
        console.error(err)
      }
      res.redirect('/projects')
    })
  });

  return router;
}
