# TJ Chat

![Powered by](https://img.shields.io/badge/powered%20by-electricity-blue.svg)
[![MIT Licence](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Deploy status](https://cmtt.dploy.io/badge/56046447932552/31955.svg)](http://tjournal.ru/chat)

## How to install
1. Create config file
    ```bash
    cp config.example.js config.js
    ```

2. Install dependencies
    ```bash
    npm install
    ```

3. Change salt in `config.js` and `public/iframe.html`
4. Change domain name to your (default is `localhost:3000`) in `public/iframe.html` and in function `gotMessage()` of `public/static/js/chat.js`
5. Start chat

    ```bash
    node .
    ```
6. Go to `http://localhost:3000/iframe.html`