Let's try something a bit different.

Model changes:
Add a UtcLastSorted field to both Reward and Consequence.

e.g. 
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

UI Changes:
Create a task-ranker2.html page that has two tabs. 

Tab 1: Rewards
The first tab is for ranking rewards. The rewards are collected from all the tasks and displayed in a list. The user can drag the rows up/down to re-order. 
Each row displays four columns: (the reward text (no pill), the task text, the reward score (which updates after each drag event), and an task icon (a hyperlink which takes you to the task-edit page for that task). 
After the drag completes, the UtcLastSorted date for the task is updated with the current time, and the reward score is recalculated: 0 starts at the bottom, with the highest score being for the first row. 
The score is stored in the Score field on the Reward.

To avoid artificial scores, when re-calculating the score we will ignore rows that have not got a UtcLastSorted date.
In order to make it clear to the user which items have not been sorted yet, no score is displayed for rows with no UtcLastSorted. 
If it is possible to have rows with no UtcLastSorted kept in a holding area seperately that will be great. Otherwise Rows with no UtcLastSorted will be displayed at the bottom.

Tab 2: Consequences
This works exactly like the Rewards tab but for ranking Consequences instead of Rewards.
