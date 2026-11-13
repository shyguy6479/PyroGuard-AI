import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "fire_detection.db")


def init_database():
    """Creates the SQLite database and incidents table if they do not exist."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_code TEXT UNIQUE NOT NULL,
            timestamp TEXT NOT NULL,
            detection_type TEXT NOT NULL,
            confidence REAL NOT NULL,
            screenshot_path TEXT NOT NULL,
            source TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Active',
            email_sent INTEGER NOT NULL DEFAULT 0
        )
    """)

    conn.commit()
    conn.close()
    print(f"SQLite database initialized at: {DB_PATH}")


if __name__ == "__main__":
    init_database()
