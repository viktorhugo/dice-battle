## Envio Indexer

*Please refer to the [documentation website](https://docs.envio.dev) for a thorough guide on all [Envio](https://envio.dev) indexer features*

### Run

```bash
pnpm dev
```

Visit http://localhost:8080 to see the GraphQL Playground, local password is `testing`.

### Generate files from `config.yaml` or `schema.graphql`

```bash
pnpm codegen
```

### Pre-requisites

- [Node.js (use v18 or newer)](https://nodejs.org/en/download/current)
- [pnpm (use v8 or newer)](https://pnpm.io/installation)
- [Docker desktop](https://www.docker.com/products/docker-desktop/)

### Local setup for generated subpackage

The indexer uses a generated ReScript subpackage at `packages/envio-indexer/generated`. Before running the local indexer, you must install and build that package:

```bash
cd packages/envio-indexer/generated
pnpm install --ignore-workspace
pnpm build
```

Then start the main indexer:

```bash
cd ../
pnpm dev
```

If `pnpm dev` fails with `Cannot find module './src/db/Migrations.res.js'`, install the missing generated dependency:

```bash
cd packages/envio-indexer/generated
pnpm install --ignore-workspace @envio-dev/hypersync-client
```
