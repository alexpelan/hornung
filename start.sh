#!/bin/bash
cd ~/latest
NODE_ENV=production sudo pm2 start app.js