const express = require("express");
const app = express();
const PORT = 8080;
const bodyParser = require("body-parser");
const cookies = require("cookie-parser");

app.use(cookies());
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");

const urlDatabase = {
  "b2xVn2": "http://www.lighthouselabs.ca",
  "9sm5xK": "http://www.google.com"
};

const users = {
  "user": {
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

function addLongURL(shortURL, longURL) {
  urlDatabase[shortURL] = "";
  if (!longURL.match(/^[a-zA-Z]+:\/\//)) {
    urlDatabase[shortURL] += "http://";
  }
  urlDatabase[shortURL] += longURL;
}

app.get("/", (req, res) => {
  res.send("Hello!");
});

app.get("/register", (req, res) => {
  let templateVars = {username: req.cookies["username"]};
  res.render("register", templateVars);
});

app.get("/u/:shortURL", (req, res) => {
  const longURL = urlDatabase[req.params.shortURL];
  res.status(301).redirect(longURL);
});

app.get("/urls", (req, res) => {
  let templateVars = {
    username: req.cookies["username"],
    urls: urlDatabase
  };
  res.render("urls_index", templateVars);
});

app.get("/urls/new", (req, res) => {
  let templateVars = {username: req.cookies["username"]};
  res.render("urls_new", templateVars);
});

app.get("/urls/:shortURL", (req, res) => {
  let templateVars = {
    username: req.cookies["username"],
    shortURL: req.params.shortURL,
    longURL: urlDatabase[req.params.shortURL]
  };
  res.render("urls_show", templateVars);
});

app.get("/urls.json", (req, res) => {
  res.json(urlDatabase);
});

app.get("/hello", (req, res) => {
  res.send("<html><body>Hello <b>World</b></body></html>\n");
});

app.get("/:nonexistent", (req, res) => {

})

app.post("/login", (req, res) => {
  res.cookie("username", req.body.username);
  res.redirect("/urls");
});

app.post("/logout", (req, res) => {
  res.clearCookie("username");
  res.redirect("/urls");
});

app.post("/register", (req, res) => {
  let newId = generateRandomString();
  users[newId] = {id: newId, email: req.body.email, password: req.body.password};
  res.cookie("user_id", newId);
  res.redirect("/urls");
});

app.post("/urls", (req, res) => {
  let shortURL = generateRandomString();
  addLongURL(shortURL, req.body.longURL);
  res.redirect("/urls/" + shortURL);
});

app.post("/urls/:shortURL", (req, res) => {
  addLongURL(req.params.shortURL, req.body.longURL);
  res.redirect(req.get('referer'));
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