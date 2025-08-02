# backend/alembic/env.py
from logging.config import fileConfig
import os
from dotenv import load_dotenv

from sqlalchemy import engine_from_config
from sqlalchemy import pool # Keep this import
from alembic import context

load_dotenv() # Load environment variables FIRST

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# IMPORTANT: Corrected import path for Base
# Assuming alembic/env.py is run with 'backend' as the current working directory
# or 'backend' is in PYTHONPATH, this path should be relative to 'backend'.
# If you run 'alembic' command from the 'backend' folder, then:
from app.models.models import Base
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = os.getenv("DATABASE_URL")
    if url is None:
        raise ValueError("DATABASE_URL environment variable is not set.")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    db_url = os.getenv("DATABASE_URL")
    if db_url is None:
        raise ValueError("DATABASE_URL environment variable is not set.")

    connectable_config = config.get_section(config.config_ini_section, {})
    connectable_config["sqlalchemy.url"] = db_url
    connectable_config["sqlalchemy.poolclass"] = pool.NullPool # Corrected: assign the class

    connectable = engine_from_config(
        connectable_config,
        prefix="sqlalchemy.",
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()