#!/bin/bash
cd ~/latest
pm2 kill
NODE_ENV=production pm2 start app.js