-- DRAFT: review and rehearse against a verified production snapshot first.
-- No seeds, drops, updates or automatic execution. The deployment guard stays on.
CREATE TABLE friendships (
 id INTEGER NOT NULL PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id),
 friend_id INTEGER NOT NULL REFERENCES users(id),
 status VARCHAR(8) NOT NULL,
 created_at DATETIME NOT NULL,
 CONSTRAINT uq_user_friend UNIQUE(user_id, friend_id)
);
CREATE TABLE groups (
 id INTEGER NOT NULL PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 created_at DATETIME NOT NULL
);
CREATE TABLE group_members (
 id INTEGER NOT NULL PRIMARY KEY,
 group_id INTEGER NOT NULL REFERENCES groups(id),
 user_id INTEGER NOT NULL REFERENCES users(id),
 role VARCHAR(6) NOT NULL,
 joined_at DATETIME NOT NULL,
 CONSTRAINT uq_group_user UNIQUE(group_id, user_id)
);
CREATE TABLE messages (
 id INTEGER NOT NULL PRIMARY KEY,
 sender_id INTEGER NOT NULL REFERENCES users(id),
 recipient_id INTEGER REFERENCES users(id),
 group_id INTEGER REFERENCES groups(id),
 content VARCHAR(2000) NOT NULL,
 created_at DATETIME NOT NULL
);
