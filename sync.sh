#!/bin/sh

rsync -av --exclude package-lock.json --exclude node_modules ./src pi@192.168.0.31:/home/pi/radio/
ssh pi@192.168.0.31 "sudo pm2 restart all"