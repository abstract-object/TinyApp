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

// Check if any user in the database has the specified email. Return
// the associated user if so.
const getUserWithEmail = (address) => {
  for (let user in users) {
    if (users[user].email === address) {
      return user;
    }
  }
  return null;
};

// Return an object of urls associated with the specified user id.
const urlsForUser = (id) => {
  let ownURL = {};
  for (let shortURL in urlDatabase) {
    if (urlDatabase[shortURL].userId === id) {
      ownURL[shortURL] = urlDatabase[shortURL];
    }
  }
  return ownURL;
};

// Return the appropriate status code based on the message (url query) given.
const errorHandling = (message) => {
  if (!message) {
    return 200;
  }

  if (message === "no-login") {
    return 401;
  } else if (message === "existing-user" || message === "invalid-params") {
    return 400;
  } else {
    return 403;
  }
};

// Return appropriate template variables based on current user logged in, and
// the path and query string of the url. Action determines the behaviour of the
// account page (login or register), and err is required for all error messages.
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

// Hash a random string for the cookie secret key.
app.use(cookieSession({name: 'session', secret: bcrypt.hashSync(generateRandomString(), 10)}));

// Method override with query.
app.use(methodOverride('_method'));

// If already logged in, /, login, and register redirect to /urls.
app.get("/", (req, res) => {
  if (users[req.session.user_id]) {
    return res.redirect("/urls");
  }

  res.redirect("/login");
});

app.get("/login", (req, res) => {
  let id = req.session.user_id;

  if (users[id]) {
    return res.redirect("/urls");
  }

  // Render appropriate error messages if there is a query string specifying an error.
  let templateVars = getTemplateVars(id, req.path.substring(1), req.query.err);
  let code = errorHandling(templateVars.err);
  res.status(code).render("accounts", templateVars);
});

app.get("/register", (req, res) => {
  let id = req.session.user_id;

  if (users[id]) {
    return res.redirect("/urls");
  }

  // Render appropriate error messages if there is a query string specifying an error.
  let templateVars = getTemplateVars(id, req.path.substring(1), req.query.err);
  let code = errorHandling(templateVars.err);
  res.status(code).render("accounts", templateVars);
});

// Show list of own urls. Give 403 + message on the page if redirected while trying to access
// something belonging to another account while logged in. If not logged in, there is no error
// message, merely a message suggesting that the user log in.
app.get("/urls", (req, res) => {
  let id = req.session.user_id;
  let templateVars = getTemplateVars(id, req.path.substring(1), req.query.err);
  templateVars.urls = urlsForUser(id);
  let code = errorHandling(templateVars.err);
  res.status(code).render("urls_index", templateVars);
});

// If not logged in, the following pages redirect to the login page with a 401 + custom error message.
app.get("/urls/new", (req, res) => {
  let id = req.session.user_id;

  if (!users[id]) {
    return res.redirect("/login?err=no-login");
  }

  let templateVars = getTemplateVars(id, null, null);
  res.render("urls_new", templateVars);
});

// Give 404, 401, or 403 error depending on the circumstances. If no error, pass info to be able to
// render information on unique visitors and the actual redirecting short link (depending on where)
// this is hosted.
app.get("/urls/:shortURL", (req, res) => {
  let shortURL = req.params.shortURL;
  let id = req.session.user_id;

  if (!urlDatabase[shortURL]) {
    return res.redirect("/notfound");
  } else if (!users[id]) {
    return res.redirect("/login?err=no-login");
  } else if (id !== urlDatabase[shortURL].userId) {
    return res.redirect("/urls?err=wrong-user");
  }

  let templateVars = getTemplateVars(id, null, null);
  templateVars.protocol = req.protocol;
  templateVars.host = req.hostname;
  templateVars.shortURL = shortURL;
  templateVars.url = urlDatabase[shortURL];
  templateVars.guestbook = visitors[shortURL];
  res.render("urls_show", templateVars);
});

// For a valid link, its viewcount is incremented, and it adds the url key
// to a cookie to keep track of specific users. For each short link, if its
// id matches an id in the cookie (all of which are separated by spaces),
// then the user is considered to have visited it before.
app.get("/u/:shortURL", (req, res) => {
  let longURL = urlDatabase[req.params.shortURL].url;
  let shortURL = req.params.shortURL;

  if (!urlDatabase[shortURL]) {
    return res.redirect("/notfound");
  }

  // Init both count vars, always count up total view by 1.
  if (!urlDatabase[shortURL].count) {
    urlDatabase[shortURL].count = 0;
    urlDatabase[shortURL].unique = 0;
  }
  urlDatabase[shortURL].count += 1;

  // Process info from the visit cookie.
  let visited = req.session.visit;

  // If the user never visited before, generate a visitor id. Else,
  // retrieve their id
  let id;
  if (!visited) {
    id = generateRandomString();
    visited = id;
  }
  id = visited.substring(0, 6);

  // If the cookie doesn't have the current link, increment unique
  // count, and save link to cookie. Add the visitor and date of
  // visit to visitor database.
  if (!visited.includes(shortURL)) {
    visited += ` ${shortURL}`;
    req.session.visit = visited;
    urlDatabase[shortURL].unique += 1;
    visitors[shortURL] = {[id]: new Date()};
  }
  res.redirect(longURL);
});

app.get("/urls.json", (req, res) => {
  res.json(urlDatabase);
});

// Render 404 page for all invalid paths.
app.get("*", (req, res) => {
  let templateVars = getTemplateVars(req.session.user_id, null, null);
  res.status(404).render("misc", templateVars);
});

// Log in user, or else give appropriate error depending on what user did incorrectly.
app.post("/login", (req, res) => {
  let existingUser = getUserWithEmail(req.body.email);
  let err;

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

// Register if provided with valid email (that wasn't already registered) and password,
// else return relevant error. Check for valid email with format (anything)@(anything).(anything)
app.post("/register", (req, res) => {
  let email = req.body.email;
  let existingUser = getUserWithEmail(email);
  let err;

  if (existingUser) {
    err = "existing-user";
  } else if (!email.match(/^.+@.+\..+/) || !email || !req.body.password) {
    err = "invalid-params";
  }

  if (err) {
    return res.redirect(`/register?err=${err}`);
  }

  // A newly registered user gets random string as id and has their password hashed.
  let newId = generateRandomString();
  users[newId] = {id: newId, email: req.body.email, password: bcrypt.hashSync(req.body.password, 10)};
  req.session.user_id = newId;
  res.redirect("/urls");
});

// For all of the following:
// Redirect to login with 401 if not logged in. If already logged in and trying to modify
// a link of another account, redirect and give 403.
app.post("/urls", (req, res) => {
  let id = req.session.user_id;

  if (!users[id]) {
    return res.redirect("/login?err=no-login");
  }

  // New link; generate random string for short url, add current time.
  let shortURL = generateRandomString();
  addLongURL(shortURL, req.body.longURL, id, new Date());
  res.redirect("/urls/" + shortURL);
});

app.put("/urls/:shortURL", (req, res) => {
  let shortURL = req.params.shortURL;
  let id = req.session.user_id;

  if (!users[id]) {
    return res.redirect("/login?err=no-login");
  } else if (id !== urlDatabase[shortURL].userId) {
    return res.redirect("/urls?err=wrong-user");
  }

  // Updating a url is like creating a new link, but keeping the existng short url.
  // Reset the count, unique visitors, and date created and change the target url.
  addLongURL(shortURL, req.body.longURL, id, new Date());
  res.redirect("/urls");
});

app.delete("/urls/:shortURL/delete", (req, res) => {
  let shortURL = req.params.shortURL;
  let id = req.session.user_id;

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