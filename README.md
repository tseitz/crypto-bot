# crypto

My crypto alerts and trading bot

Current Deploy Method:
If not added
`heroku git:remote -a trading-view-webhook`
Creating a subtree and deploying to heroku
`git subtree split --prefix packages/trading-bot/server -b deploy`
`git push heroku deploy:master`

Power up and down:
`heroku ps:scale web=0`
`heroku ps:scale web=1`
