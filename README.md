# rhmap-mongo-express
A Mongo Express application to be deployed in RHMAP

### Steps to Run
1. Create a new default app, start it, and update the mongo database immediately
2. Force push this code to the app's git URL
3. Start the app
4. Go to the app's url
5. Log in using your RHMAP credentials
6. Add one or more databases, copying the `FH_MONGODB_CONN_URL` environman variable value from each app/env that you would like to view from here.
7. Restart the application from the RHMAP Studio, to create the new routes
8. Go back into the app, and connect to your databases from there!
