## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.
a microservice for handling nft tickets on ON_TON platform

## Installation

```bash
$ yarn install
```

## Running the app

```bash
$ docker-compose -f docker-compose.modules.yml up -d
$ docker-compose -f docker-compose.redis.yml up -d
$ docker-compose -f docker-compose.minio.yml up -d
```

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Test

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## License

Nest is [MIT licensed](LICENSE).
