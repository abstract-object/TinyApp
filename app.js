"use strict";
const PORT = 8080;
const express = require("express");
const methodOverride = require('method-override')
const bcrypt = require('bcrypt');
const bodyParser = require("body-parser");
const cookieSession = require("cookie-session");

// Database stores short url as key, with long url and user as values.
const urlDatabase = {};

// Each user has an id, email, and (hashed) password.
const users = {};

// Track unique visitors.
const visitors = {};

// Generate a random alphanumeric string; convert a number to base 36, then remove 0.
// The resultant string should be at least six characters long, and should not match
// an existing url, user id, or visitor id once it is truncated to six characters.
const generateRandomString = () => {
  let randomStr = "";
  while (randomStr.length < 6 || urlDatabase[randomStr.substring(0, 6)] || users[randomStr.substring(0, 6)] || visitors[randomStr.substring(0, 6)]) {
    randomStr = Math.random().toString(36).replace("0.", "");
  }
  return randomStr.substring(0, 6);
};

// Create a new entry or update an existing one in the url database. The long url, if
// there is no protocol, will automatically use http:// so that the redirection can
// be performed successfully.
const addLongURL = (shortURL, longURL, id, date) => {
  urlDatabase[shortURL] = {url: "", userId: id};
  if (!longURL.match(/^\w+:\/\//)) {
    urlDatabase[shortURL].url += "http://";
  }
  urlDatabase[shortURL].url += longURL;
  urlDatabase[shortURL].date = date;
};

// Check if any user in the database has the queried email. Return
// the associated user if so.
const getUserWithEmail = (address) => {
  for (let user in users) {
    if (users[user].email === address) {
      return user;
    }
  }
  return null;
};

// Return an array of urls associated with the queried user.
const urlsForUser = (id) => {
  let ownURL = [];
  for (let shortURL in urlDatabase) {
    if (shortURL.userId === id) {
      ownURL.push(shortURL);
    }
  }
  return ownURL;
};

const errorHandling = (message) => {
  if (!message) {
    return 200;
  }

  if (message === "no-login") {
    return 401;
  } else if (message === "existing-user" || "invalid-params") {
    return 400;
  } else {
    return 403;
  }
};

const getTemplateVars = (id, path, query) => {
  let output = {
    user: users[id],
    action: path,
    err: query
  };

  return output;
};

const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

// Hash a random string for the cookie secret key
app.use(cookieSession({name: 'session', secret: bcrypt.hashSync(generateRandomString(), 10)}));

// Method override with query
app.use(methodOverride('_method'));

// If already logged in, /, login, and register redirect to /urls
app.get("/", (req, res) => {
  if (users[req.session.user_id]) {
    return res.redirect("/urls");
  } else {
    res.redirect("/login");
  }
});

app.get("/login", (req, res) => {
  if (users[req.session.user_id]) {
    return res.redirect("/urls");
  }

  let templateVars = getTemplateVars(req.session.user_id, req.path.substring(1), req.query.err);

  let code = errorHandling(templateVars.err);

  res.status(code).render("accounts", templateVars);
})

app.get("/register", (req, res) => {
  if (users[req.session.user_id]) {
    return res.redirect("/urls");
  }

  let templateVars = getTemplateVars(req.session.user_id, req.path.substring(1), req.query.err);

  let code = errorHandling(templateVars.err);

  res.status(code).render("accounts", templateVars);
});

app.get("/urls", (req, res) => {
  let templateVars = getTemplateVars(req.session.user_id, req.path.substring(1), req.query.err);
  templateVars.urls = urlDatabase;

  let code = errorHandling(templateVars.err);

  res.status(code).render("urls_index", templateVars);
});

// If not logged in, the following pages "redirect" to login page...
// they render instead of redirect, to give custom error messages
app.get("/urls/new", (req, res) => {
  if (!users[req.session.user_id]) {
    return res.redirect("/login?err=no-login");
  } else {
    let templateVars = getTemplateVars(req.session.user_id, null, null);
    res.render("urls_new", templateVars);
  }
});

app.get("/urls/:shortURL", (req, res) => {
  if (!urlDatabase[req.params.shortURL]) {
    return res.redirect("/notfound");
  } else if (!users[req.session.user_id]) {
    return res.redirect("/login?err=no-login");
  } else if (req.session.user_id !== urlDatabase[req.params.shortURL].userId) {
    return res.redirect("/urls?err=wrong-user");
  } else {
    let shortURL = req.params.shortURL;
    let templateVars = getTemplateVars(req.session.user_id, null, null);
    templateVars.host = req.hostname;
    templateVars.shortURL = shortURL;
    templateVars.urls = urlDatabase[shortURL];
    templateVars.guestbook = visitors[shortURL];
    res.render("urls_show", templateVars);
  }
});

app.get("/urls.json", (req, res) => {
  res.json(urlDatabase);
});

// For a valid link, its viewcount is incremented, and it adds the url key
// to a cookie to keep track of specific users. For each short link, if its
// id matches an id in the cookie (all of which are separated by spaces),
// then the user is considered to have visited it before.
app.get("/u/:shortURL", (req, res) => {
  if (!urlDatabase[req.params.shortURL]) {
    return res.redirect("/notfound");
  }

  let longURL = urlDatabase[req.params.shortURL].url;
  let shortURL = req.params.shortURL;

  if (!urlDatabase[shortURL].count) {
    urlDatabase[shortURL].count = 0;
    urlDatabase[shortURL].unique = 0;
  }
  urlDatabase[shortURL].count += 1;

  let visited = req.session.visit;
  if (!visited || !visited.includes(shortURL)) {
    let visitorId = generateRandomString();
    visited += ` ${shortURL}`;
    req.session.visit = visited;
    urlDatabase[shortURL].unique += 1;
    visitors[req.params.shortURL] = {visitorId: new Date()};
  }
  res.redirect(longURL);
});

// 404 page for all invalid paths
app.get("*", (req, res) => {
  let templateVars = getTemplateVars(req.session.user_id, null, null);
  res.status(404).render("misc", templateVars);
});

app.post("/login", (req, res) => {
  let existingUser = getUserWithEmail(req.body.email);
  let err;
  // login if correct user and password, else return relevant error
  if (existingUser) {
    if (bcrypt.compareSync(req.body.password, users[existingUser].password)) {
      req.session.user_id = users[existingUser].id;
      return res.redirect("/urls");
    } else {
      err = "wrong-password";
    }
  } else {
    err = "no-user";
  }
  res.redirect(`/login?err=${err}`);
});

app.post("/logout", (req, res) => {
  req.session.user_id = null;
  res.redirect("/urls");
});

app.post("/register", (req, res) => {
  let existingUser = getUserWithEmail(req.body.email);
  let err;

  // register if not existing user and with valid email and password, else return relevant error
  // check for valid email with format (anything)@(anything).(anything)
  if (existingUser) {
    err = "existing-user";
  } else if (!req.body.email.match(/^.+@.+\..+/) || req.body.email.length === 0 || req.body.password.length === 0) {
    err = "invalid-params";
  }

  if (err) {
    return res.redirect(`/register?err=${err}`);
  }

  // newly registered user gets random string as id and has their password hashed
  let newId = generateRandomString();
  users[newId] = {id: newId, email: req.body.email, password: bcrypt.hashSync(req.body.password, 10)};
  req.session.user_id = newId;
  res.redirect("/urls");
});

// redirect to login if not logged in for the following links
app.post("/urls", (req, res) => {
  if (!users[req.session.user_id]) {
    return res.redirect("/login?err=no-login");
  } else {
    // new link; generate random string for short url, add current time
    let shortURL = generateRandomString();
    addLongURL(shortURL, req.body.longURL, req.session.user_id, new Date());
    res.redirect("/urls/" + shortURL);
  }
});

app.put("/urls/:shortURL", (req, res) => {
  let shortURL = req.params.shortURL;
  // don't allow another user to change the link
  if (!users[req.session.user_id]) {
    return res.redirect("/login?err=no-login");
  } else if (req.session.user_id !== urlDatabase[shortURL].userId) {
    return res.redirect("/urls?err=wrong-user");
  } else {
    // updating a url is like creating a new link, but keeping the exisitng short url
    // reset count, unique visitors, and date created
    addLongURL(shortURL, req.body.longURL, req.session.user_id, new Date());
    res.redirect("/urls");
  }
});

app.delete("/urls/:shortURL/delete", (req, res) => {
  let shortURL = req.params.shortURL;
  let id = req.session.user_id;

  // don't allow another user to delete the link
  if (!users[id]) {
    return res.redirect("/login?err=no-login");
  } else if (id !== urlDatabase[shortURL].userId) {
    return res.redirect("/urls?err=wrong-user");
  }

  delete urlDatabase[shortURL];
  res.redirect("/urls");
});

app.listen(PORT, () => {
  console.log(`TinyApp listening on port ${PORT}!`);
});