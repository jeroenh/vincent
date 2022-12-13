### Local (Development) Install

1. Clone the repository

2. Setup a virtual environment and install requirements

```
python3 -m venv env
source env/bin/activate
pip install -r requirements.txt
```

3. Create Databases for VINCE-NT and OAuth2Provider (if using)

```
psql postgres
CREATE ROLE vincent;
ALTER ROLE vincent CREATEDB;
ALTER ROLE "vincent" WITH LOGIN;
CREATE DATABASE vincent;
GRANT ALL PRIVILEGES ON DATABASE vincent TO vincent;

CREATE DATABASE adviseprovider;
GRANT ALL PRIVILEGES ON DATABASE adviseprovider TO vincent;
```

4. Edit oauth2provider/oauth2provider/.env with the following env variables

```
SECRET_KEY (see step 7 to generate)
DATABASE_URL=postgres://postgres@127.0.0.1:5432/adviseprovider
DB_USER=vincent
DB_NAME=adviseprovider
DB_PASS (optional, omit if you used above instructions)
ALLOWED_HOSTS (optional)

```

5. Migrate and run OAuth2Provider in a separate terminal with active virtualenv

```
cd advise/oauth2provider
python manage.py migrate
python manage.py runserver 8080
```

6. Install node dependencies and run webpack dev server

```
cd ..
npm install
npx webpack-dev-server
```


7. Generate VINCE-NT Secret Key

```
python3 -c 'from django.core.management.utils import get_random_secret_key;print(get_random_secret_key())'
```

8. Generate VINCE-NT API Hash Salt (optional, otherwise SECRET_KEY will be used. If using SECRET_KEY, swap out any "$" characters otherwise an error will occur when generating API Tokens)

```
python3 -c 'import secrets; print(secrets.token_hex(8))'
```

9. Create vincent/.env file with following environment variables

```
DATABASE_URL=postgres://postgres@127.0.0.1:5432/vincent
DB_USER=vincent
DB_NAME=vincent
SECRET_KEY='XXXXXXXXXXXXXXX'
DEBUG=True
API_HASH_SALT='XXXXXXXXXXX'
APP_SERVER_FQDN='localhost:8000'  # by default when start django server (step #13), it will start on port 8000. Change this if you choose a different port
```

10. Make static directory and migrate Database

```
mkdir static
python manage.py migrate
```

11. Create superuser for initial login

```
python manage.py createsuperuser
```

12. Load initial data

```
python manage.py loadinitialdata
```

13. Run VINCE-NT

```
python manage.py runserver
```

14. You should now be able to login with superuser credentials at localhost:8000


15. When you first login, you'll be required to confirm the email you used in step 11. In the terminal where you are running VINCE-NT, you will see the email confirmation.  Copy and paste the link into your browser to "confirm" your email.  You will then be required to setup multi-factor authentication.

## Setup OAuth2Provider

16. Follow [Step IV. Set up an Oauth2 Application](./README-quickstart.md#iv-set-up-an-oauth2-application) but use http://localhost:8000 and http://localhost:8080 as URLs.


