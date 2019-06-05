const express = require("express");
const app = express();
const PORT = 8080;
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");

const urlDatabase = {
  "b2xVn2": "http://www.lighthouselabs.ca",
  "9sm5xK": "http://www.google.com"
};

function generateRandomString() {
  let randomStr = "";
  while (randomStr.length < 6 || urlDatabase[randomStr.substring(0, 6)]) {
    randomStr = Math.random().toString(36).replace('0.', '');
  }
  return randomStr.substring(0, 6);
}

app.get("/", (req, res) => {
  res.send("Hello!");
});

app.get("/u/:shortURL", (req, res) => {
  const longURL = urlDatabase[req.params.shortURL];
  res.status(301).redirect(longURL);
});

app.get("/urls", (req, res) => {
  let templateVars = {urls: urlDatabase};
  res.render("urls_index", templateVars);
});

app.get("/urls/new", (req, res) => {
  res.render("urls_new");
});

app.get("/urls/:shortURL", (req, res) => {
  let templateVars = {shortURL: req.params.shortURL, longURL: urlDatabase[req.params.shortURL]};
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

app.post("/urls", (req, res) => {
  let shortURL = generateRandomString();

  if (!/:\/\//) {
    urlDatabase[shortURL] = req.body.longURL;
    res.redirect(/urls/ + shortURL);
  }
  else {
    urlDatabase[shortURL] = "http://" + req.body.longURL;
    res.redirect(/urls/ + shortURL);
  }
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});