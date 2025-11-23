pm2 delete educaia
pm2 start ./start.sh --name educaia
pm2 save
pm2 startup
pm2 save
pm2 startup