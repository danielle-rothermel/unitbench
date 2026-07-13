# Signed bundle integrity boundary

Unitbench accepts only `UNITBENCH_BUNDLE_INTEGRITY_PUBLIC_KEYS`, a JSON object
mapping non-revoked key ids to base64 DER/SPKI Ed25519 public keys. It never
accepts a private key. Removing a key revokes it immediately; retain an old key
until its signed bundles are no longer pinned or retained.

Each request pins an exact promoted bundle, starts a repeatable-read
transaction on the same connection, verifies the versioned canonical signed
payload, then runs one count/digest aggregate per member. The page query uses
that same transaction. Any malformed metadata, unknown key, signature error,
digest capability error, timeout, missing relation, or mismatch is reported as
`PINNED_BUNDLE_GONE`; the pin is deleted in `finally`.

The trust boundary is the Platform Ed25519 signer, this public-key ring, and
the destination's snapshot semantics. Database metadata and member contents
are untrusted. Reader roles should have only member `SELECT` plus the narrow
pin insert/delete/select grants; they must not promote, mutate metadata, or
run DDL/DML. This does not protect against a malicious database owner that can
forge query results, a compromised signer, or (for local DuckDB) a compromised
OS account that controls both the database and signer key.
