# Redis Abstraction Layer

Schema-based abstraction layer for redis database interactions

## Installation

```bash
npm install @kurai-io/redis
# or
yarn add @kurai-io/redis
```


## Usage

### Create redis client

```typescript
// foundation.ts

import { redis } from "@kurai-io/redis"

const client = redis.createClient({ url: "..." })
await client.connect()

// Connection can be performed in in-line manner too
const client2 = await redis.createClient({ url: "..." }).connect()

export { client }
```

### Define template and model

_Note: for templates, redis plugin uses `@sigiljs/seal`, so you can create
templates by your own, without `.template()` helper_

```typescript
const userModel = redis.defineSchema<{ userId: string }>({
  // Optional, time in seconds after which record
  // will be deleted, default - undefined
  ttl: 120,
  // Optional, if true, will automatically remove
  // record after first read, default - false
  readOnce: true,
  // Optional, define custom namespace name for
  // current schema. If not set, namespace
  // will be automatically generated
  namespace: "CoolNS"
})

```

### Set, get or delete records using schema

> Note: any redis operations should be performed **only** after
> calling the `.connect()` method of the client

Using a set, set with a random key and get:
```typescript
const key = await userModel.set("key1", {
  userId: "1234567890"
})

// Or you can insert entry with random key
const randKey = await userModel.randomKey.set({
  userId: "1234567890"
})

const entry = await userModel.get(randKey) // => { userId: ... }
```

Using helpers:
```typescript
userModel.with("myKey", entry => {
  // This code will be executed only if
  // myKey found and valid
})
```

## License

You can copy and paste the MIT license summary from below.

```text
MIT License

Copyright (c) 2022 Kurai Foundation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

