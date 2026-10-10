# Requirements

I need to build the task board with design as `design/design.html`.

- Create: use "New task" in the header, the "+" or "Add task" on any column, or press N. A task has a title (required), description, priority, status, task type, assignee and story points.
- Update: click a card to edit it in a form. On desktop you can also drag cards between columns or reorder them.
- Bulk status change: choose several tasks and move them to a status at once, with an Undo option for a few seconds. Turn on selection with "Select" in the header, then click or tap cards; on desktop you can also Ctrl/⌘-click a card or press X on it. Works on desktop and mobile.
- Delete: hover a card and click the trash icon, use Delete in the edit form, or press the Delete key on a selected card. A confirmation dialog appears first, then an Undo option for a few seconds.
- Dark/light mode: a toggle in the header. It starts from your system setting and remembers your choice.
- Mobile: under 720px wide, status tabs switch between columns, a floating "+" button adds tasks, and the form slides up from the bottom. Dragging is turned off on mobile, so you change a task's status in the form instead.
- Also included: search (press / to jump to it) and filters by priority, type and assignee.
- Sign in: sign in with your Google account, or with your email and password. Anyone can create an account: sign up with your name, email and password and you are signed in straight away. You can change your password and sign out from the account menu in the header. The app does not send any email, so there is no email confirmation and no "Forgot password?" link.
- Boards and sharing: you can have several boards and switch between them from the header. A board's owner shares it by entering a person's email address; the app creates an invite link that the owner copies and sends to them (for example in chat). The person opens the link, signs in with that email address and joins the board. Invite links expire after 7 days and can be cancelled. Members can work on all tasks; only owners can rename or delete the board and manage members. Assignees are the board's members.
- Storage: tasks and boards are saved on the server, so every member sees the same board on any device. Changes made by others appear within a few seconds. Nothing is stored in the browser's local storage.
