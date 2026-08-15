# SCOPE

## Databse Table:

SCOPE:
id: UUID
name: string
is_active: bool
sequence: int
utc_deleted: datetime (nullable)
user_id uuid not null default auth.uid() references auth.users(id) on delete cascade

## scopes.html
Also add a page called scopes.html which lists all the scopes for the user (draggable). Sorted by sequence. Dragging updates the sequence field.

Three dots on the right, opens a menu with the options: 'Rename' and 'Delete'.
- Clicking on the Rename menu opens a popup which prompts for the new name.
- Clicking on Delete will save the current time in the utc_deleted field. This will hide it from the table. A 'Show deleted' checkbox at the top of the page, will show the soft deleted scopes.

