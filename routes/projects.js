"use strict";
const express = require('express');
const router = express.Router();
const userChecker = require('../helper/userchecker')
const crypto = require("crypto");
const moment = require('moment');


module.exports = function(db) {
  /* GET home page. */

  router.get('/', userChecker, function(req, res, next) {
    console.log("router(/projects), method(get), req.session: ");
    console.log(req.session);
    let filterQuery = [];
    let isFilter = false;
    let sqlQuery = 'SELECT count(*) AS total FROM projects'


    if(req.query.cid && req.query.id) {
      filterQuery.push(`projectid = ${req.query.id}`)
      isFilter = true;
    }
    if(req.query.cname && req.query.name) {
      filterQuery.push(`name = '${req.query.name}'`)
      isFilter = true;
    }
    if(req.query.cmember && req.query.member) {
      filterQuery.push(`projectid IN(SELECT projectid FROM members WHERE userid = ${req.query.member})`)
      isFilter = true;
    }
    if(isFilter) {
      sqlQuery += ` WHERE ${filterQuery.join(" AND ")}`
    }

    //counting record data for pagination
    db.query(sqlQuery ,function(err, countData) {
      //pagination
      console.log("this is url: ", req.url);
      let url = (req.url == "/") ? "/?page=1" : req.url;
      console.log("this is url variable: ", url);
      let page = Number(req.query.page) || 1
      let limit = 3
      let offset = (page-1) * 3
      let total = countData.rows[0].total;
      let pages = (total == 0) ? 1 : Math.ceil(total/limit);
      let pagination = {page: page, limit: limit, offset: offset, pages: pages, total: total, url: url}

      let sqlQuery = 'SELECT * FROM projects'
      if(isFilter) {
        sqlQuery += ` WHERE ${filterQuery.join(" AND ")}`
      }
      sqlQuery +=  ` ORDER BY projectid ASC LIMIT ${limit} OFFSET ${offset}`
      console.log(sqlQuery);
      db.query(sqlQuery, function(err, projectsData) {
        if(err) {
          console.error(err);
        }
        console.log("ini projects ada: ");
        console.log(projectsData);
        var sqlQuery = `SELECT members.projectid,
        users.firstname || ' ' || users.lastname AS name, users.role FROM members,
        users WHERE members.userid=users.userid
        ORDER BY projectid ASC`
        db.query(sqlQuery, function(err, membersData) {
          if(err) {
            console.error(err);
          }
          console.log("ini projects data: ", projectsData.rows);
          console.log("ini members data: ", membersData.rows);
          for(let x=0; x<projectsData.rows.length; x++) {
            projectsData.rows[x].members = membersData.rows.filter(function(item) {
              return item.projectid === projectsData.rows[x].projectid;
            });
          }

          console.log("ini projects data after looping: ", projectsData);
          db.query("SELECT * FROM users", function(err, userData) {
            if(err) {
              console.err(err);
            }
            console.log("ini type session: ", typeof req.session.user)
            res.render('projects/list', {
              title: 'Express',
              page: "project",
              listData: projectsData.rows,
              userData: userData.rows,
              projectcolumns: JSON.parse(req.session.user.projectcolumns),
              query: req.query,
              pagination: pagination,
              userSession: req.session.user
            });
          });
        });
      });


    });



  });

  router.post('/projectcolumn', userChecker, function(req, res) {
    let projectcolumns = JSON.stringify(req.body);
    req.session.user.projectcolumns = projectcolumns;
    db.query("UPDATE users SET projectcolumns = $1 WHERE userid = $2", [projectcolumns, req.session.user.userid], function(err) {
      if(err) {
        console.error(err);
      }
      res.redirect('/projects')
    });
  });

  router.get('/add', userChecker, function(req, res) {
    if(req.session.user.privilege !== "Admin") {
      return res.redirect('/projects')
    }
    db.query("SELECT * FROM users", function(err, userData) {
      if(err) {
        console.error(err);
      }
      res.render('projects/add', {
        title: 'Add projects',
        page: "project",
        userData: userData.rows,
        userSession: req.session.user
      });
    });
  });

  router.post('/add', userChecker, function(req, res) {
    if(req.session.user.privilege !== "Admin") {
      return res.redirect('/projects')
    }
    db.query(`INSERT INTO projects(name) VALUES('${req.body.name}')`, function(err) {
      if(err) {
        console.error(err);
      }
      db.query("SELECT projectid FROM projects ORDER BY projectid DESC LIMIT 1", function(err, projectId) {
        if(err) {
          console.error(err);
        }
        let insertData = []
        for(var x = 0; x<req.body.members.length; x++) {
          insertData.push(`(${projectId.rows[0].projectid}, ${req.body.members[x]})`)
        }
        db.query(`INSERT INTO members(projectid, userid) VALUES ${insertData.join(',')}`, function(err) {
          if(err) {
            console.error(err);
          }
          res.redirect('/projects');
        });
      });
    });
  });

  router.get('/delete/:id', userChecker, function(req, res) {
    db.query(`DELETE FROM members WHERE projectid = ${req.params.id}`, function(err) {
      if(err) {
        console.error(err);
      }
      db.query(`DELETE FROM projects WHERE projectid = ${req.params.id}`, function(err) {
        if(err) {
          console.error(err);
        }
        res.redirect('/projects');
      });
    });
  });

  router.get('/edit/:id', userChecker, function(req, res) {
    db.query("SELECT * FROM users", function(err, userData) {
      if(err) {
        console.error(err);
      }
      db.query(`SELECT projects.projectid, projects.name, members.userid FROM projects JOIN members ON projects.projectid=members.projectid WHERE projects.projectid= ${req.params.id}`, function(err, data) {
        if(err) {
          console.error(err);
        }
        res.render('projects/edit', {
          title: "Edit Project",
          page: "project",
          data: data.rows,
          userData: userData.rows,
          members: data.rows.map(function(item) {return item.userid}),
          userSession: req.session.user
        });
      });
    })
  });

  router.post('/edit/:id', userChecker, function(req, res) {
    db.query(`UPDATE projects SET name = '${req.body.name}' WHERE projectid = ${req.params.id}`, function(err) {
      if(err) {
        console.error(err)
      }
      db.query(`DELETE FROM members WHERE projectid = ${req.params.id}`, function(err) {
        if(err) {
          console.error(err);
        }
        let insertData = []
        for(var x = 0; x<req.body.members.length; x++) {
          insertData.push(`(${req.params.id}, ${req.body.members[x]})`)
        }
        db.query(`INSERT INTO members(projectid, userid) VALUES ${insertData.join(',')}`, function(err) {
          if(err) {
            console.error(err);
          }
          res.redirect('/projects')
        });
      })
    })
  });

  router.get('/details/:id/overview', userChecker, function(req, res) {
    let sqlQuery = `SELECT members.id, users.firstname || ' ' || users.lastname AS membername,
    projects.name AS projectname FROM members JOIN users ON members.userid=users.userid
    JOIN projects ON members.projectid=projects.projectid
    WHERE members.projectid = ${req.params.id};`
    db.query(sqlQuery, function(err, projectData) {
      res.render('projects/details/overview', {
        title: "Project Details",
        page: "project",
        projectData: projectData.rows,
        idURL: req.params.id,
        userSession: req.session.user
      });
    });
  });

  router.get('/details/:id/members', userChecker, function(req, res) {
    let filterQuery = [];
    let isFilter = false;
    let sqlQuery = `SELECT members.id, users.userid, users.firstname || ' ' || users.lastname AS name, users.role FROM members
    JOIN users ON members.userid=users.userid
    JOIN projects ON members.projectid=projects.projectid
    WHERE projects.projectid = ${req.params.id}`


    console.log("======================================");
    console.log("ini req.query.id: ", req.query.id);
    console.log("ini req.query.name: ", req.query.name);
    console.log("ini req.query.position: ", req.query.position);
    console.log("ini cid: ", req.query.cid);
    console.log("ini cname ", req.query.cname);
    console.log("ini cposition ", req.query.cposition);
    console.log("======================================");

    if(req.query.cid && req.query.id) {
      filterQuery.push(`users.userid = ${req.query.id}`)
      isFilter = true;
    }

    if(req.query.cname && req.query.name) {
      let queryName = req.query.name.split(' ').filter(function(deleteSpace){return deleteSpace !== ''})
      let tempQueryArray = [];
      let tempQuery = '';
      for(var x = 0; x<queryName.length; x++) {
        tempQueryArray.push(`users.firstname LIKE '%${queryName[x]}%'`)
        tempQueryArray.push(`users.lastname LIKE '%${queryName[x]}%'`)
      }
      tempQuery = `(${tempQueryArray.join(' OR ')})`
      filterQuery.push(tempQuery)
      isFilter = true;
    }

    if(req.query.cposition && req.query.position) {
      filterQuery.push(`users.role = '${req.query.position}'`)
      isFilter = true;
    }

    if(isFilter) {
      sqlQuery += ` AND ${filterQuery.join(" AND ")}`
    }

    console.log("======================================");
    console.log("ini sqlQuery", sqlQuery);
    console.log("======================================");
    //ORDER BY users.userid
    db.query(sqlQuery, function(err, memberListData) {
      console.log(memberListData.rows);
      res.render('projects/details/members', {
        title: "Project Members",
        page: "project",
        idURL: req.params.id,
        query: req.query,
        memberListData: memberListData.rows,
        memberColumns: JSON.parse(req.session.user.membercolumns),
        userSession: req.session.user
      });
    });
  });

  router.get('/details/:id/members/delete/:iddelete', userChecker, function(req, res) {
    let sqlQuery = `SELECT * FROM projects WHERE projectid = ${req.params.id}`
    db.query(sqlQuery, function(err, projectData) {
      let projectName = projectData.rows[0].name
      let projectid = projectData.rows[0].projectid
      let activityTitle = `${projectName} #${projectid}`
      let activityDescription = "Delete a Member"
      let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
      let activityCurrentDate = `${moment().format("YYYY-MM-DD")}`
      let activietyAWeekAgo = `${moment().subtract(7, 'days').format('DD/MM/YYYY')}`
      let activityHour = `${moment().format("HH:mm")}`
      sqlQuery = `INSERT INTO activity(title, description, author, time, date, hours, projectid)
      VALUES('${activityTitle}', '${activityDescription}', '${activityAuthor}', NOW(), '${activityCurrentDate}', '${activityHour}', ${req.params.id})`

      db.query(sqlQuery, function(err) {
        if(err) {
          console.error(err)
        }
        db.query(`DELETE FROM members WHERE id = ${req.params.iddelete}`, function(err) {
          res.redirect(`/projects/details/${req.params.id}/members`);
        });
      });
    });
  });

  router.post('/details/:id/members/membercolumn', userChecker, function(req, res) {
    let memberColumns = JSON.stringify(req.body)
    req.session.user.membercolumns = memberColumns;
    let sqlQuery = `UPDATE users SET membercolumns = '${memberColumns}' WHERE userid = ${req.session.user.userid}`;
    db.query(sqlQuery, function(err) {
      console.log(sqlQuery);
      if(err) {
        console.error(err);
      }
      res.redirect(`/projects/details/${req.params.id}/members`);
    });
  });

  router.get('/details/:id/addmember', userChecker, function(req, res) {
    db.query("SELECT * FROM users", function(err, userData) {
      if(err) {
        console.error(err);
      }
      db.query(`SELECT projects.projectid, projects.name, members.userid FROM projects JOIN members ON projects.projectid=members.projectid WHERE projects.projectid= ${req.params.id}`, function(err, data) {
        if(err) {
          console.error(err);
        }
        res.render('projects/details/addmember', {
          title: "Add Member Project",
          page: "project",
          idURL: req.params.id,
          data: data.rows,
          userData: userData.rows,
          members: data.rows.map(function(item) {return item.userid}),
          userSession: req.session.user
        });
      });
    })
  });

  router.post('/details/:id/addmember', userChecker, function(req, res) {
    let sqlQuery = `SELECT * FROM projects WHERE projectid = ${req.params.id}`
    db.query(sqlQuery, function(err, projectData) {
      if(err) {
        console.error(err);
      }
      let projectName = projectData.rows[0].name
      let activityTitle = `${projectName}`
      let activityDescription = "Edit Project Member"
      let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
      let activityCurrentDate = `${moment().format("YYYY-MM-DD")}`
      let activietyAWeekAgo = `${moment().subtract(7, 'days').format('DD/MM/YYYY')}`
      let activityHour = `${moment().format("HH:mm")}`
      sqlQuery = `INSERT INTO activity(title, description, author, time, date, hours, projectid)
      VALUES('${activityTitle}', '${activityDescription}', '${activityAuthor}', NOW(), '${activityCurrentDate}', '${activityHour}', ${req.params.id})`

      db.query(sqlQuery, function(err){
        if(err) {
          console.error(err)
        }
        db.query(`UPDATE projects SET name = '${req.body.name}' WHERE projectid = ${req.params.id}`, function(err) {
          if(err) {
            console.error(err)
          }
          db.query(`DELETE FROM members WHERE projectid = ${req.params.id}`, function(err) {
            if(err) {
              console.error(err);
            }
            let insertData = []
            for(var x = 0; x<req.body.members.length; x++) {
              insertData.push(`(${req.params.id}, ${req.body.members[x]})`)
            }
            db.query(`INSERT INTO members(projectid, userid) VALUES ${insertData.join(',')}`, function(err) {
              if(err) {
                console.error(err);
              }
              res.redirect(`/projects/details/${req.params.id}/members`)
            });
          });
        });
      });
    });
  });

  router.get('/details/:id/issues', userChecker, function(req, res) {
    let sqlQuery = `SELECT projects.projectid, users.userid, users.firstname || ' ' || users.lastname AS name,
    projects.name AS projectname FROM members JOIN users ON members.userid=users.userid
    JOIN projects ON members.projectid=projects.projectid
    WHERE members.projectid = ${req.params.id};`

    db.query(sqlQuery, function(err, membersData) {
      if(err) {
        console.error(err);
      }

      let filterQuery = [];
      let isFilter = false;
      sqlQuery = 'SELECT count(*) AS total FROM issues'


      console.log("======================================");
      console.log("req.query : ");
      console.log(req.query);
      console.log("======================================");
      if(req.query.cid && req.query.id) {
        filterQuery.push(`issueid = ${req.query.id}`)
        isFilter = true;
      }

      if(req.query.csubject && req.query.subject) {
        filterQuery.push(`subject LIKE '%${req.query.subject}%'`)
        isFilter = true;
      }

      if(req.query.ctracker && req.query.tracker) {
        filterQuery.push(`tracker = '${req.query.tracker}'`)
        isFilter = true;
      }

      if(req.query.cdescription && req.query.description) {
        filterQuery.push(`description LIKE '%${req.query.description}%'`)
        isFilter = true;
      }

      if(req.query.cstatus && req.query.status) {
        filterQuery.push(`status = '${req.query.status}'`)
        isFilter = true;
      }

      if(req.query.cpriority && req.query.priority) {
        filterQuery.push(`priority = '${req.query.priority}'`)
        isFilter = true;
      }

      if(req.query.casignee && req.query.asignee) {
        filterQuery.push(`asignee = ${req.query.asignee}`)
        isFilter = true;
      }

      if(req.query.cstartdate && req.query.startdate) {
        filterQuery.push(`startdate = '${req.query.startdate}'`)
        isFilter = true;
      }

      if(req.query.cduedate && req.query.duedate) {
        filterQuery.push(`duedate = '${req.query.duedate}'`)
        isFilter = true;
      }


      if(req.query.cestimatedtime && req.query.estimatedtime) {
        filterQuery.push(`estimatedtime = '${req.query.estimatedtime}'`)
        isFilter = true;
      }

      if(req.query.cpercentagedone && req.query.percentagedone) {
        filterQuery.push(`percentagedone = ${req.query.percentagedone}`)
        isFilter = true;
      }

      if(isFilter) {
        filterQuery.push(`projectid = ${req.params.id}`)
        sqlQuery += ` WHERE ${filterQuery.join(" AND ")}`
      } else {
        sqlQuery += ` WHERE projectid = ${req.params.id}`;
      }

      console.log("======================================");
      console.log("/details/:id/issues");
      console.log(sqlQuery);
      console.log(filterQuery);
      console.log("======================================");

      db.query(sqlQuery, function(err, countData) {
        //pagination
        console.log("this is url (issue): ", req.url);
        let url = (req.url == "/") ? "/?page=1" : req.url;
        console.log("this is url (issue) variable: ", url);
        let page = Number(req.query.page) || 1
        let limit = 3
        let offset = (page-1) * 3
        let total = countData.rows[0].total;
        let pages = (total == 0) ? 1 : Math.ceil(total/limit);
        let pagination = {page: page, limit: limit, offset: offset, pages: pages, total: total, url: url}

        sqlQuery = `SELECT * FROM issues`

        if(isFilter) {
          filterQuery.push(`projectid = ${req.params.id}`)
          sqlQuery += ` WHERE ${filterQuery.join(" AND ")}`
        } else {
          sqlQuery += ` WHERE projectid = ${req.params.id}`;
        }

        sqlQuery +=  ` ORDER BY issueid ASC LIMIT ${limit} OFFSET ${offset}`

        db.query(sqlQuery, function(err, issuesData) {
          res.render('projects/details/issues', {
            title: "Project Issues",
            page: "project",
            query: req.query,
            idURL: req.params.id,
            issuesData: issuesData.rows,
            issuesColumns: JSON.parse(req.session.user.issuescolumns),
            membersData: membersData.rows,
            pagination: pagination,
            userSession: req.session.user
          });
        });
      });
    });
  });



  router.get('/details/:id/issues/delete/:issueid', userChecker, function(req, res) {
    let sqlQuery = `SELECT * FROM issues WHERE issueid = ${req.params.issueid}`;
    db.query(sqlQuery, function(err, issueData) {
      let subject = issueData.rows[0].subject
      let tracker = issueData.rows[0].tracker
      let projectid = issueData.rows[0].projectid
      let status = issueData.rows[0].status
      let activityTitle = `${subject} ${tracker} #${projectid} (${status})`
      let activityDescription = "Delete Issue"
      let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
      let activityCurrentDate = `${moment().format("YYYY-MM-DD")}`
      let activietyAWeekAgo = `${moment().subtract(7, 'days').format('DD/MM/YYYY')}`
      let activityHour = `${moment().format("HH:mm")}`
      sqlQuery = `INSERT INTO activity(title, description, author, time, date, hours, projectid)
      VALUES('${activityTitle}', '${activityDescription}', '${activityAuthor}', NOW(), '${activityCurrentDate}', '${activityHour}', ${req.params.id})`
      db.query(sqlQuery, function(err) {
        if(err) {
          console.error(err);
        }
        db.query(`DELETE FROM issues WHERE issueid = ${req.params.issueid}`, function(err) {
          res.redirect(`/projects/details/${req.params.id}/issues`);
        });
      });
    });
  });

  router.get('/details/:id/issues/edit/:issueid', userChecker, function(req, res) {
    let sqlQuery = `SELECT * FROM issues WHERE issueid = ${req.params.issueid}`
    db.query(sqlQuery, function(err, selectedIssueData) {
      if(err) {
        console.error(err);
      }
      sqlQuery = `SELECT projects.projectid, users.userid, users.firstname || ' ' || users.lastname AS membername,
      projects.name AS projectname FROM members JOIN users ON members.userid=users.userid
      JOIN projects ON members.projectid=projects.projectid
      WHERE members.projectid = ${req.params.id};`

      db.query(sqlQuery, function(err, membersData) {
        if(err) {
          console.error(err);
        }
        res.render('projects/details/editissues', {
          title: "Project Issues",
          page: "project",
          query: req.query,
          idURL: req.params.id,
          issueidURL: req.params.issueid,
          selectedIssueData: selectedIssueData.rows[0],
          membersData: membersData.rows,
          userSession: req.session.user
        });
      });
    });
  });

  router.post('/details/:id/issues/edit/:issueid', userChecker, function(req, res) {
    let issueid = req.params.issueid;
    let projectid = req.params.id
    let tracker = req.body.tracker;
    let subject = req.body.subject;
    let description = req.body.description;
    let status = req.body.status;
    let priority = req.body.priority;
    let asignee = req.body.asignee;
    let startDate = req.body.startdate;
    let dueDate = req.body.duedate;
    let estimatedTime = req.body.estimatedtime;
    let percentageDone = req.body.percentagedone;

    let sqlQuery = `UPDATE issues SET tracker = '${tracker}', subject = '${subject}', description = '${description}',
    status = '${status}', priority = '${priority}', asignee = ${asignee}, startdate = '${startDate}',
    duedate = '${dueDate}', estimatedtime = ${estimatedTime} WHERE issueid = ${issueid}`

    console.log(sqlQuery);

    db.query(sqlQuery, function(err) {
      if(err) {
        console.error(err);
      }
      let activityTitle = `${subject} ${tracker} #${projectid} (${status})`
      let activityDescription = "Edit Issue"
      let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
      let activityCurrentDate = `${moment().format("YYYY-MM-DD")}`
      let activietyAWeekAgo = `${moment().subtract(7, 'days').format('DD/MM/YYYY')}`
      let activityHour = `${moment().format("HH:mm")}`
      sqlQuery = `INSERT INTO activity(title, description, author, time, date, hours, projectid)
      VALUES('${activityTitle}', '${activityDescription}', '${activityAuthor}', NOW(), '${activityCurrentDate}', '${activityHour}', ${req.params.id})`
      console.log("====================================");
      console.log("/details/:id/issues/edit/:issueid");
      console.log("ini sql query activity: ");
      console.log(sqlQuery);
      console.log("====================================");
      db.query(sqlQuery, function(err) {
        if(err) {
          console.error(err)
        }
      });
      res.redirect(`/projects/details/${req.params.id}/issues`);
    });
  });

  router.get('/details/:id/issues/edit/:issueid/deleteimage/:imagename', userChecker, function(req, res) {
    let sqlQuery = `SELECT * FROM issues WHERE issueid = ${req.params.issueid}`;
    let fileNameNoExt = req.params.imagename.replace(/\..+$/, '')
    console.log(fileNameNoExt);
    db.query(sqlQuery, function(err, issueData) {
      if(err) {
        console.error(err);
      }
      console.log("====================================");
      console.log("/details/:id/issues/edit/:issueid/deleteimage/:imagename");
      console.log("issueData.rows: ");
      console.log(issueData.rows);
      console.log("====================================");
      let fileIssueDataObject = JSON.parse(issueData.rows[0].files);
      delete fileIssueDataObject[fileNameNoExt]
      let insertedDataFile = JSON.stringify(fileIssueDataObject);
      sqlQuery = `UPDATE issues SET files = '${insertedDataFile}' WHERE issueid = ${req.params.issueid}`
      db.query(sqlQuery, function(err) {
        if(err) {
          console.error(err);
        }
        let subject = issueData.rows[0].subject
        let tracker = issueData.rows[0].tracker
        let projectid = issueData.rows[0].projectid
        let status = issueData.rows[0].status
        let activityTitle = `${subject} ${tracker} #${projectid} (${status})`
        let activityDescription = "Delete a Picture"
        let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
        let activityCurrentDate = `${moment().format("YYYY-MM-DD")}`
        let activietyAWeekAgo = `${moment().subtract(7, 'days').format('DD/MM/YYYY')}`
        let activityHour = `${moment().format("HH:mm")}`
        sqlQuery = `INSERT INTO activity(title, description, author, time, date, hours, projectid)
        VALUES('${activityTitle}', '${activityDescription}', '${activityAuthor}', NOW(), '${activityCurrentDate}', '${activityHour}', ${req.params.id})`
        console.log("====================================");
        console.log("/details/:id/issues/edit/:issueid/deleteimage/:imagename");
        console.log("ini sql query activity: ");
        console.log(sqlQuery);
        console.log("====================================");
        db.query(sqlQuery, function(err) {
          if(err) {
            console.error(err)
          }
          res.redirect(`/projects/details/${req.params.id}/issues/edit/${req.params.issueid}`);

        });
      });
    });
  });

  router.get('/details/:id/issues/upload/:issueid', userChecker, function(req, res) {
    res.render('projects/details/uploadfile', {
      title: "Project Issues",
      page: "project",
      idURL: req.params.id,
      issueidURL: req.params.issueid,
      userSession: req.session.user
    });
  });

  router.post('/details/:id/issues/upload/:issueid', userChecker, function(req, res) {
    if(!req.files) {
      return res.status(400).send('No files were uploaded.');
    }
    let fileName = crypto.randomBytes(20).toString('hex');
    let uploadFile = req.files.uploadedfile;
    let fileExtension = uploadFile.name.split('.').pop();
    let sqlQuery = ''
    uploadFile.mv(`${__dirname}/../public/assets/${fileName}.${fileExtension}`, function(err) {
      if(err) {
        return res.status(500).send(err);
      }
      sqlQuery = `SELECT * FROM issues WHERE issueid = ${req.params.issueid}`;
      db.query(sqlQuery, function(err, issueData) {
        if(err) {
          console.error(err);
        }

        console.log("====================================");
        console.log("/details/:id/issues/upload/:issueid");
        console.log("issueData.rows: ");
        console.log(issueData.rows);
        console.log("====================================");

        let fileIssueDataObject = JSON.parse(issueData.rows[0].files);
        fileIssueDataObject[fileName] = `${fileName}.${fileExtension}`
        let insertedDataFile = JSON.stringify(fileIssueDataObject);
        sqlQuery = `UPDATE issues SET files = '${insertedDataFile}' WHERE issueid = ${req.params.issueid}`;
        console.log(sqlQuery);
        db.query(sqlQuery, function(err) {
          if(err) {
            console.error(err);
          }
          let subject = issueData.rows[0].subject
          let tracker = issueData.rows[0].tracker
          let projectid = issueData.rows[0].projectid
          let status = issueData.rows[0].status
          let activityTitle = `${subject} ${tracker} #${projectid} (${status})`
          let activityDescription = "Upload a Picture"
          let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
          let activityCurrentDate = `${moment().format("YYYY-MM-DD")}`
          let activietyAWeekAgo = `${moment().subtract(7, 'days').format('DD/MM/YYYY')}`
          let activityHour = `${moment().format("HH:mm")}`
          sqlQuery = `INSERT INTO activity(title, description, author, time, date, hours, projectid)
          VALUES('${activityTitle}', '${activityDescription}', '${activityAuthor}', NOW(), '${activityCurrentDate}', '${activityHour}', ${req.params.id})`

          console.log("====================================");
          console.log("/details/:id/issues/upload/:issueid");
          console.log("ini sql query ke table activiety :");
          console.log(sqlQuery);
          console.log("====================================");
          db.query(sqlQuery,function(err) {
            if(err) {
              console.error(err);
            }
            res.redirect(`/projects/details/${req.params.id}/issues`);
          })

        });
      });
    });



  });

  router.post('/details/:id/issues/issuescolumn', userChecker, function(req, res) {
    let issuesColumns = JSON.stringify(req.body)
    req.session.user.issuescolumns = issuesColumns
    let sqlQuery = `UPDATE users SET issuescolumns = '${issuesColumns}' WHERE userid = ${req.session.user.userid}`
    db.query(sqlQuery, function(err) {
      if(err) {
        console.error(err);
      }
      res.redirect(`/projects/details/${req.params.id}/issues`);
    });
  });

  router.get('/details/:id/issues/new', userChecker, function(req, res) {
    let sqlQuery = `SELECT projects.projectid, users.userid, users.firstname || ' ' || users.lastname AS membername,
    projects.name AS projectname FROM members JOIN users ON members.userid=users.userid
    JOIN projects ON members.projectid=projects.projectid
    WHERE members.projectid = ${req.params.id};`
    db.query(sqlQuery, function(err, membersData) {
      res.render('projects/details/newissue', {
        title: "Project Issues",
        page: "project",
        query: req.query,
        idURL: req.params.id,
        membersData: membersData.rows,
        userSession: req.session.user
      });
    });
  });

  router.post('/details/:id/issues/new', userChecker, function(req, res) {
    console.log("======================================");
    console.log("/details/:id/issues/new");
    console.log("======================================");
    console.log("======================================");
    console.log("ini req.body : ");
    console.log(req.body);
    console.log("======================================");

    let projectid = req.body.projectid;
    let tracker = req.body.tracker;
    let subject = req.body.subject;
    let description = req.body.description;
    let status = req.body.status;
    let priority = req.body.priority;
    let asignee = req.body.asignee;
    let startDate = req.body.startdate;
    let dueDate = req.body.duedate;
    let estimatedTime = req.body.estimatedtime;
    let percentageDone = req.body.percentagedone;
    let files = req.body.files;

    let sqlQuery = `INSERT INTO issues(projectid, tracker, subject, description, status,
      priority, asignee, startdate, duedate, estimatedtime, percentagedone, files)
      VALUES(${projectid}, '${tracker}', '${subject}', '${description}', '${status}',
      '${priority}', ${asignee}, '${startDate}', '${dueDate}', ${estimatedTime},
      ${percentageDone}, '${files}')`

      db.query(sqlQuery, function(err) {
        if(err) {
          console.error(err);
        }
        console.log("======================================");
        console.log("/details/:id/issues/new");
        console.log("req.session.user ", req.session.user);
        console.log("======================================");
        let activityTitle = `${subject} ${tracker} #${projectid} (${status})`
        let activityDescription = "Add Issue"
        let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
        let activityCurrentDate = `${moment().format("YYYY-MM-DD")}`
        //let activietyAWeekAgo = `${moment().subtract(7, 'days').format('DD/MM/YYYY')}`
        let activityHour = `${moment().format("HH:mm")}`
        sqlQuery = `INSERT INTO activity(title, description, author, time, date, hours, projectid)
        VALUES('${activityTitle}', '${activityDescription}', '${activityAuthor}', NOW(), '${activityCurrentDate}', '${activityHour}', ${req.params.id})`
        console.log("ini query activity: ", sqlQuery);
        db.query(sqlQuery, function(err) {
          if(err) {
            console.error(err);
          }
          res.redirect(`/projects/details/${req.params.id}/issues`)
        });
      });
    });

    router.get('/details/:id/activity', userChecker, function(req, res) {
      let activityCurrentDate = `${moment().format('YYYY-MM-DD')}`
      let activietyAWeekAgo = `${moment().subtract(7, 'days').format('YYYY-MM-DD')}`
      let sqlQuery = `SELECT * FROM activity WHERE projectid = ${req.params.id} AND date BETWEEN '${activietyAWeekAgo}' AND '${activityCurrentDate}'`;
      console.log(sqlQuery);
      db.query(sqlQuery, function(err, data) {
        let activityData = data.rows;
        let dateViewData = [ [,],  [,], [,], [,], [,], [,], [,] ];
        for(let x = 0; x< 7; x++) {
          dateViewData[x][0] = moment().subtract(x, 'days').format('YYYY-MM-DD');
          dateViewData[x][1] = moment(dateViewData[x][0], 'YYYY-MM-DD').format('dddd, MMMM D, YYYY')
          dateViewData[x].push(activityData.filter(function(item){
            return moment(item.date).format('YYYY-MM-DD') === dateViewData[x][0]}));
        }
        console.log(dateViewData);
        console.log();
        res.render('projects/details/activity', {
          title: "Project Activity",
          page: "project",
          idURL: req.params.id,
          date: {today: moment().format('DD/MM/YYYY'),
          weekAgo: moment().subtract('days', 7).format('DD/MM/YYYY')},
          logDate: dateViewData,
          userSession: req.session.user
        });
      });
    });

    return router;

  }
