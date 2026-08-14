
# Context:

## DataStructure:

Loop:
- Id: UUID
- ShortName: string
- Notes: string
- Sequence: int

LoopExecution:
- Id: UUID
- LoopId: UUID
- UtcDate: date
- UtcStartTime: datetime
- UtcDuration: timespan
- Notes: string
- NotesForNextLoop: string

## UI
### LoopDashboard:
List all the loops in a table
Data: pull out all loops inner joined with most recent LoopExecution (by UtcDate).
Columns for:
    - Name (get it from ShortName), 
    - LastExecuted (get it from UtcDate), 
    - Button that will take you to View LoopExecutions
Table must be sortable, by Name (default), and by Last Executed

### LoopExecutions
Required: LoopID
Show Notes for that Loop at the top
Underneath, two columns. On left, show all loop executions for the LoopID (Date, Timespan in hours)
Clicking on a LoopExecution will show the LoopExecution on the same screen, in the right column.

User can edit Notes for the Loop itself at the top
User can edit Notes for the LoopExecution in the right column (once selected).
User can click on a button to create a new Loop. 
On the Loop Execution, a button called 'Start Timer' will a) put the current time in UtcStartTime, and display a button called 'Stop Timer'.
When Stop Timer is pressed, then a) UtcDuration is calculated from now - UtcStartTime, and this duration added to the existing duration in UtcDuration. This allows a user to start/stop multiple times, and each time UtcDuration will get appended to.


Task:
Create the loop-dashboard.html and loop-executions.html page
Use local storage for now. But bear in mind we will be using PostGres on SupaBase. Please give advice on next steps to storing the data in postgres on Supabse instead of local storage.