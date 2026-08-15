# Demo paths — three failure modes

Always start green:

```bash
npm run preflight
npm run demo:reset
```

Interactive runner:

```bash
npm run demo:paths              # menu
npm run demo:paths -- list      # print this summary
npm run demo:paths -- drift
npm run demo:paths -- compile
npm run demo:paths -- dup
npm run demo:paths -- all       # run all break showcases (long)
```

---

## 1) Schema drift

| | |
|--|--|
| **Break** | `npm run sf:break` → renames `STAGING.ORDERS.amount` → `order_amount` |
| **Observe** | `npm run dbt:run` → `invalid identifier 'AMOUNT'` |
| **Incident** | `fixtures/incidents/schema-drift.json` |
| **Heal** | `npm run demo:heal` |
| **Expected heal** | Patch `stg_orders` / `orders_daily` / yml + sources to `order_amount` |

```bash
npm run demo:reset
npm run demo:paths -- drift
npm run demo:heal
```

### Phase 1 — auto-trigger (ALTER → heal)

Polls `INFORMATION_SCHEMA` for `ORDER_AMOUNT` without `AMOUNT`, then `POST /incidents` (debounced once per watcher process).

```bash
# Terminal 1 — heal webhook
npm run server

# Terminal 2 — RO poller (default every 15s)
npm run watch:drift
# optional: npm run watch:drift -- --dry-run --once
# optional: npm run watch:drift -- --interval 10

# Terminal 3 / Snowsight — create drift
npm run demo:reset   # if not already green
npm run sf:break
# or: ALTER TABLE HEAL_DEMO.STAGING.ORDERS RENAME COLUMN amount TO order_amount;
```

Watcher posts a unique `inc-schema-drift-watch-*` incident; server runs the multi-agent heal loop. Reset with `npm run demo:reset` and restart `watch:drift` for another take.

---

## 2) dbt compile fail

| | |
|--|--|
| **Break** | `npm run demo:break-compile` → `stg_orders` refs missing `orders_bronze` |
| **Observe** | `npm run dbt:compile` → Compilation Error (model not found) |
| **Incident** | `fixtures/incidents/compile-fail.json` |
| **Heal** | `npm run demo:heal:compile` |
| **Expected heal** | Restore `from {{ source('heal', 'orders') }}` (remove bad `ref`) |

```bash
npm run demo:reset
npm run demo:paths -- compile
npm run demo:heal:compile
```

---

## 3) dbt test — duplicate records

| | |
|--|--|
| **Break** | `npm run sf:break-dup` → inserts duplicate `order_id` 1 and 2 |
| **Observe** | `dbt run` succeeds; `dbt test` fails `unique_*_order_id` |
| **Incident** | `fixtures/incidents/duplicate-orders.json` |
| **Heal** | `npm run demo:heal:dup` |
| **Expected heal** | Dedupe in `stg_orders` e.g. `qualify row_number() over (partition by order_id order by order_ts desc) = 1`. Source unique may still fail (upstream DQ / RO — call out in REPORT). |

```bash
npm run demo:reset
npm run demo:paths -- dup
npm run demo:heal:dup
```

---

## Interview tip

Pick **one** path for the live 20‑minute core (schema drift is strongest), then show the other two as **menu + 60‑second break/fail** without full heal if time is tight.
