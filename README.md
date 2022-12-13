## VINCE-NT

## Description

VINCE-NT (the Vulnerability and INformation Coordination Environment - New Technologies) is a multi-party vulnerability reporting, coordination, and disclosure platform. VINCE-NT allows PSIRTs and other coordinators manage access to information and to track vulnerabilities from initial reporting through public disclosure.

VINCE-NT is a hybrid React/Django project. Most views are React single-page applications that receive data through the Django REST Framework API. As such, there are a few steps to spin up a development environment. The included docker-based dev/test environment is the preferred method for quick installation. See [docs/README-quickstart](docs/README-quickstart.md) for instructions.

VINCE-NT supports OAuth2 and local authentication through the [django-allauth](https://django-allauth.readthedocs.io/en/latest/index.html) library.
An OAuth2 provider is included with VINCE-NT or you can configure an OAuth2 provider of your choosing. Supported providers and instructions can be found [here](https://django-allauth.readthedocs.io/en/latest/providers.html).

There are multiple configuration options, specifically for authentication and multi-factor authentication. See [docs](docs).

Swagger API documentation is provided through [drf-yasg](https://github.com/axnsan12/drf-yasg/) and can be accessed through your [local installation](http://localhost:8000/swagger).

## Installation

* [Quickstart](docs/README-quickstart.md)
* [Local install](docs/dev-install.md)
* Examples of more complex installations can be found in [deploy/examples](deploy/examples)

## Documentation

* [Documentation](docs)

## Tests

VINCE-NT Tests can be found in [cvdp/tests](cvdp/tests). The tests cover most user roles access to most API endpoints. There are two options to run application tests. If the application is running locally, use `manage.py` to run tests:

``` {.sh}
python manage.py test
```

If a local environment is not set up (for instance, in CI/CD pipelines, or when deploying to cloud providers), the tests can also be run in the containerized test environment using `docker-compose`:

1. Copy the `deploy/docker/example.env.test.local` into the top-level directory (where you are reading this) as `.env.test.local`.

2. Edit `.env.test.local` and change the `POSTGRES_PASSWORD`, `DB_PASS`, and the three `DJANGO_SUPERUSER_*` variables as appropriate.
**NOTE**: The `POSTGRES_PASSWORD` and `DB_PASS` **MUST MATCH**. This file cannot make reference to variables declared inside itself.

3. Uncomment the line to set the `RUN_TESTS_ONLY` variable.

4. Build the containers: `docker compose -f deploy/docker/docker-compose-test.yml build`

5. Run the tests: `docker compose -f deploy/docker/docker-compose-test.yml up --exit-code-from vincent`

The process will exit with the exit code of the vincent container after running the tests, or with the exit code from the first container that fails prior to the tests running. Logs will be output to the console. This is useful for CI/CD pipelines and automated testing frameworks.

## Contributing

Contributions require a Developer Certificate of Origin (DCO) sign-off and a Contributor License Agreement (CLA) for non-holders. 
See CONTRIBUTING.md.

## Roadmap

VINCE-NT is under active development. In the coming months, we plan to improve upon the existing implementation and add many new features.

## License

Licensed under the GNU Affero General Public License v3.0 only (AGPL-3.0-only). See LICENSE. 
 
## Trademarks 
The GNU Affero General Public License does not grant rights to use Tharros Defense, Inc. trademarks or logos. 
See TRADEMARKS.md.
