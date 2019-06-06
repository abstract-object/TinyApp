const PORT = 8080;
const express = require("express");
const bcrypt = require('bcrypt');
const bodyParser = require("body-parser");
const cookieSession = require("cookie-session");

const urlDatabase = {
  "b2xVn2": {url: "http://www.lighthouselabs.ca", userId: "user"},
  "9sm5xK": {url: "http://www.google.com", userId: "user"}
};

const users = {
  user: {
    id: "user",
    email: "user@example.com",
    password: bcrypt.hashSync("swordfish", 10)
  }
};

const generateRandomString = () => {
  let randomStr = "";
  while (randomStr.length < 6 || urlDatabase[randomStr.substring(0, 6)] || users[randomStr.substring(0, 6)]) {
    randomStr = Math.random().toString(36).replace('0.', '');
  }
  return randomStr.substring(0, 6);
}

const addLongURL = (shortURL, longURL, id) => {
  urlDatabse[shortURL] = {url: "", userId: id};
  if (!longURL.match(/^[a-zA-Z]+:\/\//)) {
    urlDatabase[shortURL].url += "http://";
  }
  urlDatabase[shortURL].url += longURL;
}

const checkEmailExists = (address) => {
  for (let user in users) {
    if (users[user].email === address) {
      return [true, user];
    }
  }
  return [false, null];
}

const urlsForUser = (id) => {
  let ownURL = [];
  for (let shortURL in urlDatabase) {
    if (shortURL.userId === id) {
      ownURL.push(shortURL);
    }
  }
  return ownURL;
}

const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieSession({name: 'session', secret: bcrypt.hashSync(generateRandomString(), 10)}));

app.get("/", (req, res) => {
  res.send("Hello!");
});

app.get("/login", (req, res) => {
  let templateVars = {user: users[req.session.user_id]};
  res.render("login", templateVars);
})

app.get("/register", (req, res) => {
  let templateVars = {user: users[req.session.user_id]};
  res.render("register", templateVars);
});

app.get("/u/:shortURL", (req, res) => {
  const longURL = urlDatabase[req.params.shortURL].url;
  res.status(301).redirect(longURL);
});

app.get("/urls", (req, res) => {
  let templateVars = {
    user: users[req.session.user_id],
    urls: urlDatabase
  };
  res.render("urls_index", templateVars);
});

app.get("/urls/new", (req, res) => {
  if (!users[req.session.user_id]) {
    res.redirect("/login");
  }
  let templateVars = {user: users[req.session.user_id]};
  res.render("urls_new", templateVars);
});

app.get("/urls/:shortURL", (req, res) => {
  let templateVars = {
    user: users[req.session.user_id],
    host: req.hostname,
    shortURL: req.params.shortURL,
    longURL: urlDatabase[req.params.shortURL].url
  };
  res.render("urls_show", templateVars);
});

app.get("/urls.json", (req, res) => {
  res.json(urlDatabase);
});

app.get("/hello", (req, res) => {
  res.send("<html><body>Hello <b>World</b></body></html>\n");
});

app.get("/error", (req, res) => {
  res.send("Something went wrong.");
})

app.post("/login", (req, res) => {
  let existingUser = checkEmailExists(req.body.email);

  if (existingUser[0]) {
    if (bcrypt.compareSync(req.body.password, users[existingUser[1]].password)) {
      req.session.user_id = users[existingUser[1]].id;
      res.redirect("/urls");
    }
  }
  res.status(403).redirect("/error");
});

app.post("/logout", (req, res) => {
  req.session.user_id = null;
  res.redirect("/urls");
});

app.post("/register", (req, res) => {
  let existingUser = checkEmailExists(req.body.email);
  if (existingUser[0]) {
    res.status(400).redirect("/error");
  } else if (req.body.email.length === 0 || req.body.password.length === 0) {
    res.status(400).redirect("/error");
  } else {
    let newId = generateRandomString();
    users[newId] = {id: newId, email: req.body.email, password: bcrypt.hashSync(req.body.password, 10)};
    req.session.user_id = newId;
    res.redirect("/urls");
  }
});

app.post("/urls", (req, res) => {
  if (!users[req.session.user_id]) {
    res.redirect("/login");
  } else {
    let shortURL = generateRandomString();
    addLongURL(shortURL, req.body.longURL, req.cookies("user_id"));
    res.redirect("/urls/" + shortURL);
  }
});

app.post("/urls/:shortURL", (req, res) => {
  if (!users[req.session.user_id]) {
    res.redirect("/login");
  } else if (req.session.user_id !== urlDatabase[req.params.shortURL].userId) {
    res.redirect("/error");
  } else {
    addLongURL(req.params.shortURL, req.body.longURL, req.session.user_id);
    res.redirect("/urls");
  }
});

app.post("/urls/:shortURL/delete", (req, res) => {
  if (!users[req.session.user_id]) {
    res.redirect("/login");
  } else if (req.session.user_id !== urlDatabase[req.params.shortURL].userId) {
    res.redirect("/error");
  } else {
    if (urlDatabase[req.params.shortURL]) {
      delete urlDatabase[req.params.shortURL];
    }
    res.redirect("/urls");
  }
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});