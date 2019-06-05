const express = require("express");
const app = express();
const PORT = 8080;
const bodyParser = require("body-parser");
const cookies = require("cookie-parser");

app.use(cookies());
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");

const urlDatabase = {
  "b2xVn2": {url: "http://www.lighthouselabs.ca", userId: "user"},
  "9sm5xK": {url: "http://www.google.com", userId: "user"}
};

const users = {
  user: {
    id: "user",
    email: "user@example.com",
    password: "swordfish"
  }
};

function generateRandomString() {
  let randomStr = "";
  while (randomStr.length < 6 || urlDatabase[randomStr.substring(0, 6)] || users[randomStr.substring(0, 6)]) {
    randomStr = Math.random().toString(36).replace('0.', '');
  }
  return randomStr.substring(0, 6);
}

function addLongURL(shortURL, longURL, id) {
  urlDatabase[shortURL].userId = id;
  urlDatabase[shortURL].url = "";
  if (!longURL.match(/^[a-zA-Z]+:\/\//)) {
    urlDatabase[shortURL].url += "http://";
  }
  urlDatabase[shortURL].url += longURL;
}

function checkEmailExists(address) {
  for (let user in users) {
    if (users[user].email === address) {
      return [true, user];
    }
  }
  return [false, null];
}

function urlsForUser(id) {
  let ownURL = [];
  for (let shortURL in urlDatabase) {
    if (shortURL.userId === id) {
      ownURL.push(shortURL);
    }
  }
  return ownURL;
}

app.get("/", (req, res) => {
  res.send("Hello!");
});

app.get("/login", (req, res) => {
  let templateVars = {user: users[req.cookies["user_id"]]};
  res.render("login", templateVars);
})

app.get("/register", (req, res) => {
  let templateVars = {user: users[req.cookies["user_id"]]};
  res.render("register", templateVars);
});

app.get("/u/:shortURL", (req, res) => {
  const longURL = urlDatabase[req.params.shortURL].url;
  res.status(301).redirect(longURL);
});

app.get("/urls", (req, res) => {
  let templateVars = {
    user: users[req.cookies["user_id"]],
    urls: urlDatabase
  };
  res.render("urls_index", templateVars);
});

app.get("/urls/new", (req, res) => {
  if (!users[req.cookies["user_id"]]) {
    res.redirect("/login");
  }
  let templateVars = {user: users[req.cookies["user_id"]]};
  res.render("urls_new", templateVars);
});

app.get("/urls/:shortURL", (req, res) => {
  let templateVars = {
    user: users[req.cookies["user_id"]],
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
  let emailExists = checkEmailExists(req.body.email);

  if (emailExists[0]) {
    if (req.body.password === users[emailExists[1]].password) {
      res.cookie("user_id", users[emailExists[1]].id);
      res.redirect("/urls");
    }
  }
  res.status(403).redirect("/error");
});

app.post("/logout", (req, res) => {
  res.clearCookie("user_id");
  res.redirect("/urls");
});

app.post("/register", (req, res) => {
  let emailExists = checkEmailExists(req.body.email);
  if (emailExists[0]) {
    res.status(400).redirect("/error");
  } else if (req.body.email.length === 0 || req.body.password.length === 0) {
    res.status(400).redirect("/error");
  } else {
    let newId = generateRandomString();
    users[newId] = {id: newId, email: req.body.email, password: req.body.password};
    res.cookie("user_id", newId);
    res.redirect("/urls");
  }
});

app.post("/urls", (req, res) => {
  let shortURL = generateRandomString();
  addLongURL(shortURL, req.body.longURL, req.cookies("user_id"));
  res.redirect("/urls/" + shortURL);
});

app.post("/urls/:shortURL", (req, res) => {
  addLongURL(req.params.shortURL, req.body.longURL, req.cookies("user_id"));
  res.redirect("/urls");
});

app.post("/urls/:shortURL/delete", (req, res) => {
  if (urlDatabase[req.params.shortURL]) {
    delete urlDatabase[req.params.shortURL];
  }
  res.redirect("/urls");
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});