# crypto

My crypto alerts and trading bot

Current Deploy Method:
If not addedherok
`heroku git:remote -a trading-view-webhook`
Creating a subtree and deploying to heroku
`git subtree split --prefix packages/trading-bot/server -b deploy`
`git push heroku deploy:master`
