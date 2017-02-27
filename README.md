# rhmap-mongo-express
A Mongo Express application to be deployed in RHMAP

### Steps to Run
1. Create a new default RHMAP project/app, start it, and update the mongo database immediately
2. Force push this code to the app's git URL
3. Redeploy the app
4. Go to the app's url
5. Log in using your RHMAP credentials
6. Add one or more databases, copying the `FH_MONGODB_CONN_URL` environmant variable value from each app/env that you would like to view from here. (You can add this app's Mongo URL first to see what it looks like.)
7. Restart the application from the RHMAP Studio -- this is required to create new ExpressJS routes
8. Go back into the app, and connect to your databases from there!

### Notes
1. Not all environments may be reached by a single rhmap-mongo-express deployment. For instance, to connect to the databases of projects and Mbaas services in Prod, you may need to deploy this app in Prod. However, rhmap-mongo-express deployed in Prod likely cannot connect to databases deployed in Dev.
