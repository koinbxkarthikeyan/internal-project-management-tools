# Ticket and chat UI

Written from the code; not every item has been checked in a browser.

## Tickets

- Shown inside their task; the task is the parent. **Create Ticket** is offered to QA, Super Admin and enabled Admins.
- **Create form:** a compact panel on top of the task's comment section. The conversation stays behind, dimmed. **Create Ticket** saves and closes; **Cancel** or Esc closes without saving.
- **List view:** Tickets as an expandable tree on the left of the Main Task page; details and comments on the right.
- **Board view:** Jira-style columns, each with its count. A Ticket opens as its own full page.

| Column | Statuses held |
| --- | --- |
| To Do | Open, Blocked, On hold (Blocked and On hold keep their own badge) |
| In Progress | In progress |
| Ready for QA | Ready for QA |
| Testing | Testing |
| Done | Done |

- **Ticket card:** ID, title, priority, assignee, created date, and a Reopened badge where it applies. Click to open; drag to another column to change status.
- **Ticket page:** status control, attachments and the activity timeline.
- Filters, search and the selected Ticket stay as they are when you switch between List and Board.
- Code: [TaskTickets.tsx](src/features/backlog/components/TaskTickets.tsx), [TicketBoard.tsx](src/features/backlog/components/TicketBoard.tsx), [TicketTree.tsx](src/features/backlog/components/TicketTree.tsx), [TicketPanel.tsx](src/features/backlog/components/TicketPanel.tsx), [TicketForm.tsx](src/features/backlog/components/TicketForm.tsx), [TicketAttachments.tsx](src/features/backlog/components/TicketAttachments.tsx), [ActivityTimeline.tsx](src/features/backlog/components/ActivityTimeline.tsx).

## Chat

- **Direct** messages and **POD** group chat (one per task). Notifications are tinted by kind; a POD line shows the sender.
- **Ticket chooser** in the chat is a searchable dropdown ("CODE · title (N new)").
- **Typing line** above the message box: "Name is typing…" (direct) or a name / "N people are typing…" (POD), with three bouncing dots. Each panel follows its own conversation. It stops after about 2 s idle, on send, on clearing, or on switching chat, and can lag up to about 1.5 s (the app polls; there is no live socket).
- **Composer:** attachments, emoji, mention, video, voice, code (searchable language picker). Enter sends; Shift+Enter adds a new line.
- **Voice** needs `https://` or `http://localhost`; on a plain http address the composer says so.
- Code: [ChatThread.tsx](src/features/messages/components/ChatThread.tsx), [ChatPane.tsx](src/features/messages/components/ChatPane.tsx), [Composer.tsx](src/features/messages/components/Composer.tsx), [TypingLine.tsx](src/features/messages/components/TypingLine.tsx), [useTyping.ts](src/features/messages/components/useTyping.ts).
