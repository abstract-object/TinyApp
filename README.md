# TinyApp Project

TinyApp is a full stack web application built with Node and Express that allows users to shorten long URLs (à la bit.ly).

## Features

- Easily register an account and create short links
- Users visiting the short links are logged, and a list of visitors and timestamps are available from the info page
- Change the URL associated with your created link or delete your link at any time
- Minimalistic, functional design
- TinyApp will (almost) never shout at you

## Final Product

![Screenshot of URLs page](https://github.com/abstract-object/TinyApp/blob/master/docs/urls-page.png)
![Screenshot of URL info page](https://github.com/abstract-object/TinyApp/blob/master/docs/url-info-page.png)
![Screenshot of changing the target URL of an existing link](https://github.com/abstract-object/TinyApp/blob/master/docs/change_url1.png)
![Screenshot showing that the previous link has a new target URL](https://github.com/abstract-object/TinyApp/blob/master/docs/change_url2.png)
![TinyApp will not ever shout at you unless you try to ask it about something you shouldn't ask](https://github.com/abstract-object/TinyApp/blob/master/docs/404.png)

## Dependencies

- Node.js
- Express
- EJS
- bcrypt
- body-parser
- cookie-session
- method-override

## Getting Started

- Install all dependencies (using the `npm install` command).
- Run the development web server using the `node express_server.js` command.