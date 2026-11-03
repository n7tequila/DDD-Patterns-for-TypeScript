# Query Side

## Purpose

Separate read-side concerns from write-side aggregate modeling when the read use case has a different shape, latency, or filtering need.

## When To Use

Use dedicated query-side models when:

- dashboards need flattened data
- reports span many aggregates
- search needs denormalized fields
- list endpoints need paging, sorting, and filtering that do not suit loading aggregates

## Rules

- Keep aggregate repositories focused on write consistency
- Define a query port in the application layer that returns read models; implement it in infrastructure with direct queries
- Read models are plain `readonly` data types, shaped for the screen or the API, not for invariants
- Query handlers never load aggregates and never call domain methods
- Do not push read-model convenience fields back into aggregate design
- Apply row-level visibility in the query itself, from the same rule the aggregate uses; never filter in the route handler after loading everything
- Page every list query; no unbounded result sets

## Shape In TypeScript

```ts
// booking/src/application/queries/booking-queries.ts
export interface UpcomingBookingView {
  readonly bookingId: BookingId;
  readonly roomName: string;
  readonly start: EpochMillis;
  readonly end: EpochMillis;
  readonly status: BookingStatus;
}

export interface BookingQueries {
  upcomingFor(member: MemberId, page: { readonly limit: number; readonly after?: EpochMillis }): Promise<readonly UpcomingBookingView[]>;
}
```

The infrastructure implementation selects only the columns the view needs and joins whatever tables it must. Joining across contexts' tables in one database is acceptable for read models only if the reading context owns a projection of that data; otherwise read through the other context's query facade.

## Projections

When a read model is expensive to compute on every request, keep a projection table:

- update it from the outbox relay, in its own transaction per event
- make the update idempotent by event ID, because the relay may deliver an event more than once
- accept that the projection lags the write side; say so in the API contract if clients care

## Placement

Common locations:

- `application/queries/` for query ports, handlers, and read model types
- `infrastructure/projections/` for the query implementations and projection updaters
- `interfaces/http/` for response shapes

## Query Side Versus Domain

The domain model enforces invariants. The query side optimizes retrieval.

Query models do not have to preserve aggregate boundaries, because they are read-only projections.
