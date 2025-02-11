# OSS-AI

## Installation

```shell 
$ pnpm install
```

## Development

Install pre-commit hook:

```shell 
$ pnpm lefthook install
```

Start the environment:

```shell 
$ docker compose up -d
```

Run the iAgent:

```shell 
$ pnpm turbo run dev
```

## Format & Lint

Run [Biome.js](https://biomejs.dev/):

```shell 
$ pnpm turbo run format
```

Fix linting and formatting errors: 

```shell 
$ pnpm turbo run format:fix
```