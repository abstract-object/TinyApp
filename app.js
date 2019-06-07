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
    res.redirect("/urls");
  } else {
    res.redirect("/login");
  }
});

app.get("/login", (req, res) => {
  if (users[req.session.user_id]) {
    res.redirect("/urls");
  } else {
    let templateVars = {
      user: users[req.session.user_id],
      action: "login",
      err: "none"
    };
    res.render("accounts", templateVars);
  }
})

app.get("/register", (req, res) => {
  if (users[req.session.user_id]) {
    res.redirect("/urls");
  } else {
    let templateVars = {
      user: users[req.session.user_id],
      action: "register",
      err: "none"
    };
    res.render("accounts", templateVars);
  }
});

app.get("/urls", (req, res) => {
  let templateVars = {
    user: users[req.session.user_id],
    urls: urlDatabase
  };
  res.render("urls_index", templateVars);
});

// If not logged in, the following pages "redirect" to login page...
// they render instead of redirect, to give custom error messages
app.get("/urls/new", (req, res) => {
  if (!users[req.session.user_id]) {
    let templateVars = {
      user: users[req.session.user_id],
      action: "login",
      err: "not logged in"
    };
    res.status(401).render("accounts", templateVars);
  } else {
    let templateVars = {
      user: users[req.session.user_id]
    };
    res.render("urls_new", templateVars);
  }
});

app.get("/urls/:shortURL", (req, res) => {
  if (!urlDatabase[req.params.shortURL]) {
    res.redirect("/notfound");
  } else if (!users[req.session.user_id]) {
    let templateVars = {
      user: users[req.session.user_id],
      action: "login",
      err: "not logged in"
    };
    res.status(401).render("accounts", templateVars);
  } else if (req.session.user_id !== urlDatabase[req.params.shortURL].userId) {
    let templateVars = {
      user: users[req.session.user_id],
      err: "wrong user"
    };
    res.status(403).render("misc", templateVars);
  } else {
    let templateVars = {
      user: users[req.session.user_id],
      host: req.hostname,
      shortURL: req.params.shortURL,
      urls: urlDatabase[req.params.shortURL],
      guestbook: visitors[req.params.shortURL]
    };
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
    res.redirect("/notfound");
  } else {
    const longURL = urlDatabase[req.params.shortURL].url;
    const shortURL = req.params.shortURL;
    if (!urlDatabase[shortURL].count) {
      urlDatabase[shortURL].count = 0;
      urlDatabase[shortURL].unique = 0;
    }
    urlDatabase[req.params.shortURL].count += 1;

    let visited = req.session.visit;
    if (!visited) {
      req.session.visit = shortURL;
      urlDatabase[shortURL].unique += 1;
      visitors[req.params.shortURL] = {};
      visitors[req.params.shortURL][generateRandomString()] = new Date();
    } else {
      if (!visited.includes(shortURL)) {
        visited += ` ${shortURL}`;
        req.session.visit = visited;
        urlDatabase[shortURL].unique += 1;
        visitors[req.params.shortURL] = {};
        visitors[req.params.shortURL][generateRandomString()] = new Date();
      }
    }
    res.redirect(longURL);
  }
});

// 404 page for all invalid paths
app.get("*", (req, res) => {
  let templateVars = {
    user: users[req.session.user_id],
    err: "not found"
  };
  res.status(404).render("misc", templateVars);
});

app.post("/login", (req, res) => {
  let existingUser = getUserWithEmail(req.body.email);
  let templateVars = {
    user: users[req.session.user_id],
    action: "login",
    err: "none"
  };

  // login if correct user and password, else return relevant error
  if (existingUser !== null) {
    if (bcrypt.compareSync(req.body.password, users[existingUser].password)) {
      req.session.user_id = users[existingUser].id;
      res.redirect("/urls");
    } else {
      templateVars.err = "wrong password";
    }
  } else {
    templateVars.err = "no user";
  }
  res.status(403).render("accounts", templateVars);
});

app.post("/logout", (req, res) => {
  req.session.user_id = null;
  res.redirect("/urls");
});

app.post("/register", (req, res) => {
  let existingUser = getUserWithEmail(req.body.email);
  let templateVars = {
    user: users[req.session.user_id],
    action: "register",
    err: "none"
  };

  // register if not existing user and with valid email and password, else return relevant error
  // check for valid email with format (anything)@(anything).(anything)
  if (existingUser !== null) {
    templateVars.err = "existing user";
  } else if (!req.body.email.match(/^.+@.+\..+/) || req.body.email.length === 0 || req.body.password.length === 0) {
    templateVars.err = "invalid email or password";
  } else {
    // newly registered user gets random string as id and has their password hashed
    let newId = generateRandomString();
    users[newId] = {id: newId, email: req.body.email, password: bcrypt.hashSync(req.body.password, 10)};
    req.session.user_id = newId;
    res.redirect("/urls");
  }
  res.status(400).render("accounts", templateVars);
});

// redirect to login if not logged in for the following links
app.post("/urls", (req, res) => {
  if (!users[req.session.user_id]) {
    res.redirect(401, "/login");
  } else {
    // new link; generate random string for short url, add current time
    let shortURL = generateRandomString();
    addLongURL(shortURL, req.body.longURL, req.session.user_id, new Date());
    res.redirect("/urls/" + shortURL);
  }
});

app.put("/urls/:shortURL", (req, res) => {
  // don't allow another user to change the link
  if (!users[req.session.user_id]) {
    res.redirect(401, "/login");
  } else if (req.session.user_id !== urlDatabase[req.params.shortURL].userId) {
    res.redirect(403, "/error");
  } else {
    // updating a url is like creating a new link, but keeping the exisitng short url
    // reset count, unique visitors, and date created
    addLongURL(req.params.shortURL, req.body.longURL, req.session.user_id, new Date());
    urlDatabase[req.params.shortURL].count = 0;
    urlDatabase[req.params.shortURL].unique = 0;
    res.redirect("/urls");
  }
});

app.delete("/urls/:shortURL/delete", (req, res) => {
  // don't allow another user to delete the link
  if (!users[req.session.user_id]) {
    res.redirect(401, "/login");
  } else if (req.session.user_id !== urlDatabase[req.params.shortURL].userId) {
    res.redirect(403, "/error");
  } else {
    if (urlDatabase[req.params.shortURL]) {
      delete urlDatabase[req.params.shortURL];
    }
    res.redirect("/urls");
  }
});

app.listen(PORT, () => {
  console.log(`TinyApp listening on port ${PORT}!`);
});