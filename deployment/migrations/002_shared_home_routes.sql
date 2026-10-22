-- Candidate migration only. NOT wired into the production installer.
-- Requires backup, stopped service, transaction and separate deployment review.
CREATE TABLE published_home_routes (
    id INTEGER NOT NULL PRIMARY KEY,
    destination VARCHAR(80) NOT NULL,
    revision INTEGER NOT NULL,
    points_json TEXT NOT NULL,
    editor_id INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL,
    UNIQUE (destination, revision)
);
CREATE INDEX ix_published_home_routes_destination ON published_home_routes(destination);
