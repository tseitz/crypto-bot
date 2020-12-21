# crypto

My crypto alerts and trading bot

Current Deploy Method:
If not added
`heroku git:remote -a trading-view-webhook`
Creating a subtree and deploying to heroku
`git subtree split --prefix packages/trading-bot-server -b deploy`
`git push heroku deploy:master`
`git push --force heroku deploy:master` if need be

Power up and down:
`heroku ps:scale web=0`
`heroku ps:scale web=1`

Docker
`docker tag local-image:tagname new-repo:tagname`
`docker push new-repo:tagname`
