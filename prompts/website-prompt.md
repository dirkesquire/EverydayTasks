Role:
You are a data analyst who builds visualization dashboards.

Context:
The goal is to build a website to help track tasks and rank them by reasons: rewards and consequences.

Tech Stack:
You can use localStorage as a database, but populate the initialisation data in json files.
Javascript Libraries:
    Use Intl for date operations

Mock Data:
To initialise the data - generate 10 fictious tasks in the context of a human trying to manage their life
Generate 1 user object

Pages:
- index.html:
    redirects to the dashboard
- task-dashboard.html:
    lists tasks sorted by due date, color-coded date badges, reward/cost/reminder pill counts, "show completed" toggle, add-task button, click-through to edit.
- task-edit.html
    full form: name, due date, done toggle, preparation-needed (value+unit → Intl.RelativeTimeFormat preview), and add/edit/remove rows for reminders, rewards, and consequences; delete with confirmation.
    
    For editting a task. 
    Can add/edit/remove reminders
    Can add/edit/remove rewards
    Can add/edit/remove consequences

- task-ranker.html
    A tool for helping to ranking tasks against each other
    Create a UI to show two tasks at a time and ask them to compare them by: Importance, Urgency, Financial Reward, Financial Consequence

    click on the task to edit

    random head-to-head matchups of two tasks, judged one criterion at a time (Importance, Urgency, Financial Reward, Financial Consequence) with a win/tie scoring system persisted in localStorage, live rankings table below.



Models:
- User:
    Id: UUID
    Name: string

- Task:
    Id: UUID
    Name: string            
    Due Date: optional datetime
    Preparation Needed: Intl.RelativeTimeFormat
    Reminders: array of datetime
    Rewards: array of Reward
    Consequences: array of Consequence
    Notes: string
    UserId: UUID
    UtcDone: datetime
    UtcCreated: datetime    
    UTcDeleted: datetime

- Reward:
    Id: UUID
    RewardType: financial, other
    Value: string
    UtcLastSorted: datetime
    
- Consequence:
    Id: UUID
    Consequence: financial, other
    Value: string
    UtcLastSorted: datetime

<task>
Create the webpages (task-dashboard.html, edit-task.html, task-ranker.html)
Display dates clearly with any dates in the past or coming up in the next 30 days highlighted.
</task>