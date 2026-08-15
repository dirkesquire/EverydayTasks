# Models

## Scope
id: UUID
name: string
is_active: bool
sequence: int
utc_deleted: datetime (nullable)
user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
