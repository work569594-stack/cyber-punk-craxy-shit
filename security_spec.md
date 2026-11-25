# Security Specification — ROOT ACCESS : 07

## 1. Data Invariants
1. A `UserSession` at `/sessions/{userId}` can only be read, created, updated, or deleted by the authenticated owner (`request.auth.uid == userId`) or a verified admin.
2. `ownerId` and `createdAt` on `/sessions/{userId}` are immutable after creation; `createdAt` and `updatedAt` must equal `request.time`.
3. A `SessionDossier` at `/sessions/{userId}/dossiers/{dossierId}` requires the parent `/sessions/{userId}` document to exist and belong to `request.auth.uid`.
4. `UniverseOverride` records at `/universe_overrides/{overrideId}` may only be created, updated, or deleted by verified admins (`isAdmin()`). Unauthenticated/non-admin list queries only expose `published == true`.
5. All document IDs (`userId`, `dossierId`, `overrideId`, `uid`) must match `^[a-zA-Z0-9_-]+$` and stay `<= 128` characters.
6. All arrays and strings have explicit upper bounds to prevent resource exhaustion.

## 2. Adversarial Payloads Covered
1. Spoofed `ownerId` on `/sessions/{userId}` creation (`ownerId != request.auth.uid`) -> DENIED.
2. Shadow field injection (`isAdmin: true` or `godMode: true`) on `/sessions/{userId}` -> DENIED by `hasOnly`.
3. Client-forged `createdAt` or `updatedAt` timestamp -> DENIED by `== request.time`.
4. Oversized `discoveredNodes` array (`> 200` items) or `summary` string (`> 4000` chars) -> DENIED.
5. Unverified email account writing to `/sessions/{userId}` -> DENIED (`email_verified == true` required).
6. Non-owner reading another user's `/sessions/{otherUid}` -> DENIED.
7. Non-admin querying unpublished `/universe_overrides` -> DENIED.
8. Non-admin creating/updating `/universe_overrides/{id}` -> DENIED.
9. Updating immutable `ownerId` or `createdAt` on `/sessions/{userId}` -> DENIED.
10. Invalid document ID containing path traversal or excessive length -> DENIED by `isValidId`.
11. Unauthenticated write to `/admins/{uid}` -> DENIED.
12. Blanket list on `/sessions` without owner filter -> DENIED by `resource.data.ownerId == request.auth.uid`.
