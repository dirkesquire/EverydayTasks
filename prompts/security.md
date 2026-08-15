create policy "Users can only access their own rows"
on tasks for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id)