from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Local SQLite database for user watchlists, portfolios, or app settings
SQLALCHEMY_DATABASE_URL = "sqlite:///./stock_market_app.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency injection for database sessions if needed for user features."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()