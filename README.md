# TJ Chat

[![Deployment status from dploy.io](https://cmtt.dploy.io/badge/56046447932552/31955.svg)](http://dploy.io)

## Installing
```bash
npm install
node .
```

Then you need to change salt in `public/iframe.html`, change domain name in `public/iframe.html` and in function `gotMessage()` of `public/static/js/chat.js`.

### Create config
```bash
cp config.example.js config.js
```
Set salt value
```
salt: 'your_salt_value'
```
