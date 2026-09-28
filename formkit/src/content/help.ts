/**
 * The help centre, by category.
 *
 * Content lifted verbatim from the design handoff. Each article gets its own
 * indexable route at /help/<id> rather than the hash routing the prototype
 * used, so search engines index 41 pages instead of one.
 *
 * Article bodies are a small Markdown subset: "## " headings, "- " bullets,
 * "> " callouts, and blank-line-separated paragraphs. See HelpArticleBody.
 */

export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
};

export type HelpCategory = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  articles: HelpArticle[];
};

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    "id": "start",
    "name": "Getting started",
    "icon": "rocket",
    "desc": "Make your first form, understand the pieces and get it in front of people.",
    "articles": [
      {
        "id": "create-first-form",
        "title": "Create your first form",
        "summary": "From an empty dashboard to a form with questions in it, in about two minutes.",
        "body": "Everything starts on the dashboard. Select Create form in the top right and choose how to begin: a blank form, one of the templates, or a duplicate of something you have already built.\n## Name it\nGive the form a name when you create it. The name is what you and your collaborators see on the dashboard, and it becomes the default title respondents see at the top of the form. You can change it at any time in Design.\n## Add questions\nThe builder opens with an empty canvas and the field library on the left. Select a field type to add it to the end, or drag it onto the canvas to drop it exactly where you want. Each question card holds the question text, optional help text, and a Required toggle.\n## Save\nThere is no save button. Every change is written as you make it, and the header shows when it was last saved.\n> A form stays a draft until you publish it. Nobody can open the link before that."
      },
      {
        "id": "form-anatomy",
        "title": "What a form is made of",
        "summary": "Questions, pages, logic, theme and settings — and which panel owns each one.",
        "body": "A Formkit form has five parts, and each has its own tab in the builder.\n- Build is the questions themselves: fields, help text, options and page breaks.\n- Design is the look: theme, colours, type, logo and which identity the form is published under.\n- Logic is the rules that skip people past questions they do not need.\n- Settings covers notifications, the closing message, spam protection and the redirect after submit.\n- Responses is everything that comes back.\n## The welcome screen\nEvery form opens with a welcome screen showing the title and an optional description. It is the first card on the canvas and cannot be deleted, but you can leave the description empty and it will not render.\n## Pages\nA page break splits the form in two. Respondents see a progress indicator and move between pages with Back and Next. Without a page break, the whole form is one scroll."
      },
      {
        "id": "publish-share",
        "title": "Publish, close and unpublish",
        "summary": "Three different states, and what each one does to your link.",
        "body": "## Publish\nPublishing makes the form live at its public link and starts accepting answers. Select Publish in the builder header, check the summary, and confirm. If you have edited a live form, the modal tells you how many changes are waiting to go out.\n## Close\nClosing a published form stops new answers but leaves the link working — people who open it see your closing message instead of the questions. Use it for a deadline, an event that filled up, or an application window that ended.\n## Unpublish\nUnpublishing takes the form back to draft. The link stops working entirely. Every response you have already collected is kept.\n> There is no on/off switch on the link itself. Closing or unpublishing is how you stop answers."
      },
      {
        "id": "version-history",
        "title": "Version history",
        "summary": "Every publish is a snapshot you can read and restore.",
        "body": "Each time you publish, Formkit takes a snapshot of the questions as they were. Open Version history from the form actions menu to see them, newest first, with the date and who published.\n## Restoring\nRestoring a version puts those questions back on the canvas. Your current questions are snapshotted first, so restoring is itself undoable. Restoring does not publish — you will see the amber \"unpublished changes\" note until you do.\n## Unpublished changes\nThe builder counts edits made since the live version. The publish modal shows that count so you always know whether respondents are seeing your latest work."
      }
    ]
  },
  {
    "id": "build",
    "name": "Building a form",
    "icon": "layout-template",
    "desc": "Questions, field types, pages and the rules that make a form quick to fill in.",
    "articles": [
      {
        "id": "add-reorder",
        "title": "Add, reorder and delete questions",
        "summary": "Working with the canvas: dragging, duplicating and the insert point.",
        "body": "## Adding\nSelect a field type in the library to append it, or drag the tile onto the canvas and drop it between two existing cards. The blue line shows where it will land. Hovering the gap between two cards also reveals a small insert point — select it to add a field in that exact position.\n## Reordering\nDrag a question card up or down. Press anywhere on the card that is not an input or a button, or use the grip in the card's toolbar, then drop it where the blue line shows. The card menu also has Move up and Move down if you prefer not to drag.\n## Duplicating and deleting\nEvery card has Duplicate and Delete in its toolbar. Duplicating copies the question text, options and required state. Deleting is immediate, and a toast offers an undo.\n> Deleting a question that a logic rule points at also removes that rule."
      },
      {
        "id": "field-types",
        "title": "Field types",
        "summary": "What each field collects and when to reach for it.",
        "body": "The library groups fields by what they collect.\n- Contact: name, email, phone, company, website. These validate their format, so a mistyped address is caught before submission.\n- Text: short text for a line, long text for a paragraph.\n- Choice: dropdown, single choice, multiple choice, yes/no.\n- Scale: rating out of five, or a numbered scale.\n- Other: number, date, time, address, file upload.\n## Options\nChoice fields hold a list of options you edit in place. Press Enter to add the next one. A dropdown with more than about eight options is easier to fill in than a long list of radio buttons.\n## Help text\nEvery field takes optional help text below the question. Use it for the thing people always ask — the format of a reference number, or what you mean by \"budget\"."
      },
      {
        "id": "required-fields",
        "title": "Required fields and validation",
        "summary": "Asking for an answer without making the form feel like a form.",
        "body": "Toggle Required on any question and it is marked with an asterisk. Respondents cannot move to the next page, or submit, until it has an answer.\n## Be sparing\nA form where everything is required is a form people abandon. Mark the fields you genuinely cannot act without — usually a contact address and one or two specifics — and leave the rest optional.\n## What is validated automatically\nEmail, phone, website and number fields check their own format. The message names the fix rather than just refusing: \"That address is missing a domain\".\n## Errors on submit\nIf a required field is empty, the form scrolls to the first one and highlights it. On a multi-page form the check runs per page, so nobody reaches the end and discovers a problem three pages back."
      },
      {
        "id": "pages",
        "title": "Pages and page breaks",
        "summary": "Splitting a long form so it does not read like a tax return.",
        "body": "Add a page break from the library or the insert point. It appears on the canvas as a full-width divider card with the page name, and everything below it until the next break is that page.\n## Naming pages\nName a page and the name shows in the builder's page list, in logic rules and in the respondent's progress indicator. Unnamed pages are numbered.\n## Reordering pages\nThe page list on the right of the canvas can be dragged to reorder whole pages at once, questions and all. Dragging the divider card on the canvas does the same thing.\n## How long is too long\nFive to seven questions per page reads comfortably. If a page needs a scroll on a phone, it is a candidate for splitting."
      },
      {
        "id": "file-uploads",
        "title": "File uploads",
        "summary": "Collecting documents, and the limits that apply.",
        "body": "Add a File upload field and respondents get a drop zone they can drag onto or select to browse.\n## Size\nEach file is capped at 10 MB. The limit is fixed and shown to the respondent under the drop zone, so nobody wastes time on a file that will be refused.\n## Accepted types\nLeave the accepted list blank to take anything. Otherwise, list extensions — .pdf .png .docx — and the picker filters to those.\n## Where files go\nUploaded files are attached to the response. Open the response in the inbox to preview or download them, and CSV exports include a link column rather than the file itself."
      }
    ]
  },
  {
    "id": "logic",
    "name": "Logic rules",
    "icon": "git-branch",
    "desc": "Show, hide and skip based on what somebody has already answered.",
    "articles": [
      {
        "id": "logic-basics",
        "title": "How logic rules work",
        "summary": "A rule watches one answer and changes what happens next.",
        "body": "Open the Logic tab and select Add rule. Every rule reads the same way: when a question has a particular answer, do something to a question or a page.\n## The parts\n- When: the question being watched.\n- Is: the answer that triggers the rule.\n- Then: show, hide or skip to.\n- Target: the question or page it applies to.\n## Order\nRules run top to bottom, and the first match wins. Drag a rule up the list to give it priority.\n## Naming\nGive a rule a name — \"Skip pricing for existing clients\" — and the list stays readable six months from now.\n> Logic only works on questions that come before the target. A rule cannot depend on an answer nobody has given yet."
      },
      {
        "id": "logic-skip",
        "title": "Skip to a page",
        "summary": "Sending people down a branch and past what does not apply.",
        "body": "Skip rules are the fastest way to make one form serve two audiences. Ask which kind of enquiry it is on page one, then skip each answer to the page that fits.\n## Set it up\nCreate a rule with Then set to Skip to, and choose a page as the target. Anyone matching the answer jumps straight there when they select Next.\n## Dead ends\nPages that can only be reached by a skip should end with a skip of their own, or people will fall through into the next branch. The Logic tab flags a page that has no way out.\n## Checking it\nUse Preview and walk each branch. The preview honours every rule, so a wrong turn shows up immediately."
      },
      {
        "id": "logic-show-hide",
        "title": "Show or hide a question",
        "summary": "Conditional questions that appear only when they are relevant.",
        "body": "A show rule keeps a question hidden until its condition is met; a hide rule does the opposite. Use show for follow-ups — \"You said other; what was it?\" — and hide for questions that stop applying.\n## Behaviour on the page\nHidden questions are not rendered at all, so they do not leave a gap, and they never count towards required validation while hidden.\n## In the responses\nA question somebody never saw is recorded as blank rather than skipped, and the responses table shows an em dash in that column.\n## Keep it shallow\nTwo levels of conditional depth is usually the limit before a form becomes hard to reason about. Beyond that, a page break and a skip rule is clearer."
      }
    ]
  },
  {
    "id": "theme",
    "name": "Themes and branding",
    "icon": "palette",
    "desc": "Make the form look like it belongs to you, not to the tool.",
    "articles": [
      {
        "id": "pick-theme",
        "title": "Pick a theme",
        "summary": "Ten presets, and what changes when you choose one.",
        "body": "The Design tab opens on the theme presets. Each one sets the background, the card surface, the accent used by buttons and selected states, and the type pairing. Selecting a preset updates the live preview beside it straight away.\n## Starting from a preset\nPresets are a starting point, not a lock. Change any individual colour afterwards and the preset becomes \"Custom\" without losing the rest of its choices.\n## Matching a brand\nIf you have brand colours, set the accent first and the background second. A dark background needs a lighter accent than the same brand would use on white — the preview shows the contrast as you go."
      },
      {
        "id": "colours-type",
        "title": "Colours, type and layout",
        "summary": "The individual controls behind a theme.",
        "body": "## Colours\nFour colours make up a theme: page background, card surface, accent and text. Each has a swatch row of suggestions plus a hex field. Error colouring is recalculated for you so a dark theme stays legible.\n## Type\nPick a font for the form from the picker. Serif families suit long-form applications; the sans families suit short enquiries. Formkit does not offer monospace faces.\n## Layout\nChoose classic, where every question is on one page, or conversational, where questions arrive one at a time with a sticky submit. Conversational suits phones and short forms; classic suits anything somebody needs to review before sending."
      },
      {
        "id": "logos",
        "title": "Logos and lockups",
        "summary": "Adding your mark, and which one shows when you have several.",
        "body": "Upload a logo in Design and it appears above the form title. A second logo creates a lockup — two marks side by side, separated by a hairline — which is how a collaboration or a client project is usually presented.\n## Order\nDrag the logo rows to reorder them. The first is yours; anything after it sits to the right.\n## Which logo appears\nA form published under a company uses that company's logo unless you override it here. A form published as yourself uses whatever you upload on the form itself.\n## Sizing\nLogos are scaled to a fixed height, so supply artwork with transparent padding trimmed off or it will look smaller than the others in the lockup."
      }
    ]
  },
  {
    "id": "share",
    "name": "Sharing and embedding",
    "icon": "share-2",
    "desc": "Links, embeds and QR codes — everything that puts the form in front of people.",
    "articles": [
      {
        "id": "share-link",
        "title": "Share a link",
        "summary": "Where the public URL comes from and how to change it.",
        "body": "Open Share from the builder header. The modal shows the form's public link, ready to copy.\n## What the link looks like\nBy default it is formkit.app/f/your-form. If you have claimed a handle — for yourself or for the company the form is published under — the link becomes formkit.app/your-handle/your-form.\n## The slug\nThe last part of the link comes from the form name and can be edited in form settings. Changing it breaks the old link, so change it before you send anything out, not after.\n> The Share modal has no link on/off switch. To stop answers, close or unpublish the form."
      },
      {
        "id": "embed",
        "title": "Embed a form",
        "summary": "Three ways to put a form inside your own site.",
        "body": "The Share modal's Embed tab gives you a snippet to paste into your site's HTML. Three modes:\n- Inline puts the form in the flow of the page, in an iframe that fills its container.\n- Popup adds a button that opens the form over your page.\n- Full screen takes over the window when triggered.\n## Height\nInline embeds are 720 pixels tall by default. Change the height in the snippet, or let a long form scroll inside its frame.\n## Styling\nThe embedded form uses its own theme, not your site's CSS. Match them by setting the form background to the same colour as the section it sits in."
      },
      {
        "id": "qr-code",
        "title": "QR codes",
        "summary": "For print, packaging, events and anywhere there is no link to click.",
        "body": "Every published form has a QR code, generated from its public link, in the Share modal. Download it as a PNG and place it on a poster, a table card, an invoice or a package insert.\n## Print size\nPrint it at 2 cm square or larger for a code people scan from arm's length; larger again for a poster read from across a room.\n## If the link changes\nThe code encodes the current URL. Claiming a handle or changing the slug changes that URL, so download a fresh code afterwards and reprint."
      }
    ]
  },
  {
    "id": "responses",
    "name": "Responses and exports",
    "icon": "inbox",
    "desc": "Reading, filtering, exporting and acting on what comes back.",
    "articles": [
      {
        "id": "read-responses",
        "title": "Read your responses",
        "summary": "The inbox, the table and the detail drawer.",
        "body": "The Responses tab lists everything the form has collected, newest first. Each row shows the time, the first couple of answers and a status badge.\n## The drawer\nSelect a row to open the full response beside the list. It shows every question and answer in order, any uploaded files, and the time taken.\n## Filtering\nFilter by completion — all, complete or partial — and search across answers. The counts above the table update with the filter, so you always know what you are looking at.\n## Marking as reviewed\nMark a response reviewed once you have acted on it. Reviewed rows drop their badge but stay in the list."
      },
      {
        "id": "partials",
        "title": "Partial responses",
        "summary": "People who started and stopped, and what you can do about it.",
        "body": "A partial response is one where somebody answered at least one question and left without submitting. Formkit keeps them, badged as partial with the number of questions answered.\n## Where they show up\nPartials are excluded from the Completed count and from the completion rate, so your headline numbers stay honest. Use the All / Complete / Partial control to see them.\n## Resuming\nEach partial has a resume link in its drawer. Send it to the respondent and they pick up where they stopped, with their answers still there.\n## Reading them as signal\nA cluster of partials that all stop at the same question usually means that question is the problem — too personal, too vague, or too much work."
      },
      {
        "id": "export-responses",
        "title": "Export to CSV or Excel",
        "summary": "Getting the data out for a spreadsheet or another tool.",
        "body": "Select Export above the responses table and choose CSV or Excel. The file downloads immediately.\n## What is in it\nOne row per response, one column per question, in canvas order, plus the submitted time and the completion status. Uploaded files appear as links.\n## Filters carry over\nThe export respects whatever filter is applied. Filter to complete responses from this month and that is exactly what you get.\n## Selected rows only\nIf you have selected rows with the checkboxes, the export offers those rows on their own."
      },
      {
        "id": "bulk-actions",
        "title": "Bulk actions",
        "summary": "Doing the same thing to twenty responses at once.",
        "body": "Select rows with their checkboxes and a dark action bar appears at the bottom of the screen with the count and the available actions.\n- Mark reviewed clears the badge on every selected row.\n- Export writes just the selection to a file.\n- Delete removes them. This cannot be undone, and the confirmation says how many.\n## Selecting everything\nThe checkbox in the table header selects everything matching the current filter, not just the rows on screen. The action bar tells you which it is."
      }
    ]
  },
  {
    "id": "notify",
    "name": "Notifications and routing",
    "icon": "bell",
    "desc": "Emails to you when a response arrives, and emails to them when it sends.",
    "articles": [
      {
        "id": "notify-self",
        "title": "Get an email for every response",
        "summary": "The owner notification, and how to make it useful.",
        "body": "Notifications are set per form, in Settings. Turn on the response alert and choose where it goes — your own address by default, or any other.\n## Subject and body\nBoth are editable and both accept variables: the form name, the submission time, and any question's answer. A subject like \"New enquiry — {{name}}\" is far easier to triage in a mailbox than \"You have a new response\".\n## Turning it off\nA busy form can produce more email than anyone wants. Switch the alert off and read the inbox instead; nothing is lost either way."
      },
      {
        "id": "notify-routing",
        "title": "Route by answer",
        "summary": "Sending different responses to different people.",
        "body": "Under the notification settings, add a routing rule: when a question has a particular answer, send the alert to a particular address instead.\n## First match wins\nRules are evaluated top to bottom and the first match decides where the email goes. Order them from most specific to least.\n## A worked example\nA support form asks \"What is this about?\" with options for billing, technical and something else. Three rules send each to the right inbox, and anything that matches nothing falls back to the default address.\n> Routing changes who is emailed. It does not change who can read the responses in Formkit — that is the collaborator roles."
      },
      {
        "id": "notify-respondent",
        "title": "Send a confirmation to the respondent",
        "summary": "The receipt people expect after filling something in.",
        "body": "Turn on the respondent confirmation and Formkit emails whoever submitted, using the email field on the form.\n## What to write\nKeep it short: confirm what they sent, say what happens next and by when. A confirmation that says nothing but \"thank you\" generates a follow-up email asking whether it arrived.\n## Reply-to\nSet a reply-to address so replies reach a person rather than disappearing.\n## Attaching a copy\nOptionally attach a copy of their answers. Useful for applications and quotes, unnecessary for a two-question enquiry.\n## The email log\nEverything Formkit sends on your behalf is recorded in the email log in Settings, with the recipient, the subject and the time."
      }
    ]
  },
  {
    "id": "people",
    "name": "Collaborators and roles",
    "icon": "users",
    "desc": "Working on a form with other people, and what each of them can do.",
    "articles": [
      {
        "id": "invite",
        "title": "Invite someone to a form",
        "summary": "Adding a collaborator, and what happens on their side.",
        "body": "Open Collaborators from the form actions menu. Enter an email address, choose a role and send the invitation.\n## Pending invitations\nAn invitation that has not been accepted sits in the pending list, where you can resend or revoke it. Accepting it adds the person to the form — not to your whole account.\n## Per form, not per account\nCollaboration is scoped to a single form. Somebody who edits your enquiry form has no access to anything else you have built until you invite them to that too.\n## Removing\nRemove a collaborator and they lose access immediately. Anything they wrote stays."
      },
      {
        "id": "roles",
        "title": "What each role can do",
        "summary": "Editor, Commenter and Viewer, spelled out.",
        "body": "- Editor can change the form — questions, logic, theme and settings — publish it, and read its responses from their own account.\n- Commenter can read the form and leave comments on questions, but cannot change anything.\n- Viewer can see the form and its responses, and nothing else.\n## Choosing\nEditor is for the person building alongside you. Commenter suits a client reviewing wording before launch. Viewer suits somebody who only needs the results.\n> An Editor reads responses. If a form collects anything sensitive, that is the question to ask before handing out the role."
      },
      {
        "id": "comments-activity",
        "title": "Comments and activity",
        "summary": "Discussing a question in place, and seeing what changed.",
        "body": "## Comments\nLeave a comment on any question card and it stays attached to that question. Open comments show a count in the builder header, so a review pass is visible without hunting. Resolve a comment when it has been dealt with.\n## Activity\nThe Activity tab records what happened to the form and when: published, unpublished, questions added or removed, collaborators invited, theme changed. It is per form and cannot be edited."
      }
    ]
  },
  {
    "id": "identity",
    "name": "Your link and companies",
    "icon": "link",
    "desc": "Your personal Formkit link, plus any companies you publish under.",
    "articles": [
      {
        "id": "claim-handle",
        "title": "Claim your Formkit link",
        "summary": "Turning formkit.app/f/enquiry into formkit.app/your-name/enquiry.",
        "body": "Formkit is person first. Your account is you, and you can claim a handle for yourself in Settings → Companies, on the personal link card.\n## What changes\nEvery form you publish as yourself moves to formkit.app/your-handle/form-name. Forms published under a company use that company's handle instead.\n## Rules\nHandles are unique across Formkit and across your own account, so a company cannot take the handle you are using. Letters, numbers and hyphens only.\n## Releasing it\nRelease a handle and your links fall back to formkit.app/f/form-name. The handle becomes available to somebody else, so release one only when you are sure."
      },
      {
        "id": "add-company",
        "title": "Add a company",
        "summary": "Companies are optional, and you can have as many as you need.",
        "body": "Most people never add one. Add a company when you publish on behalf of something that is not you: a studio, a client project, a side business.\n## Creating one\nSettings → Companies → Add company. Give it a name, and optionally a logo, a handle and brand colours. Each company gets its own link, its own logo and its own theme defaults.\n## Switching\nThe company list shows how many forms each one has. Select a company to edit its details.\n## Removing\nRemoving a company sends its forms back to you. Nothing is deleted, and the links change to your personal handle."
      },
      {
        "id": "publish-under",
        "title": "Publish under a company",
        "summary": "Choosing the identity a form goes out as.",
        "body": "Open Design → Branding. When you have at least one company, a \"Published under\" control appears. Choose yourself or any company, and the preview below shows the exact public URL.\n## What follows the choice\nThe link, the logo on the form, and the theme defaults all come from the identity you pick. Changing it on a published form changes its live link, so tell anyone who has already shared it.\n## Mixed accounts\nThere is no limit on how many identities you juggle. A freelancer running two studios and their own personal forms is a normal Formkit account."
      }
    ]
  },
  {
    "id": "ai",
    "name": "Building with AI",
    "icon": "sparkles",
    "desc": "Ask Formkit writes a form from a description — where it is available and what it costs.",
    "articles": [
      {
        "id": "ai-what",
        "title": "What Ask Formkit does",
        "summary": "Describe the form you need and it drafts the questions.",
        "body": "Ask Formkit turns a description into a working draft: fields of the right type, in a sensible order, with your wording tightened rather than replaced.\n## What you can ask for\n- A new form from a sentence: \"an intake form for a branding project, with budget and timeline\".\n- A rewrite of the copy on a form you have already built.\n- Logic: describe the branch and it writes the rules.\n- A theme suggestion based on a brand description.\n- A summary of what a batch of responses says.\n## It drafts, you decide\nEverything it produces lands on the canvas as an ordinary draft. Edit it, delete half of it, publish it — it is your form from the moment it appears."
      },
      {
        "id": "ai-access",
        "title": "Why can I not see Ask Formkit?",
        "summary": "It is on for every account, unless it has been paused or turned off for yours.",
        "body": "Ask Formkit is on for every account, on every plan. The launcher sits in the app chrome and the Ask workspace is under its own tab.\n## If you cannot see it\nA Formkit administrator can turn it off for one account — for example after misuse — and when it is off, nothing about it appears in the app. Write to support if you think that has happened by mistake.\n## If it is paused\nOccasionally the whole feature is paused across the platform, for maintenance or a model change. When the pause lifts, it comes back for everyone, with the credits you had left."
      },
      {
        "id": "ai-credits",
        "title": "Credits",
        "summary": "What spends one, what does not, and how many each plan gets.",
        "body": "Every account gets a monthly allowance of credits: 5 on Free, 50 on Pro and 200 on Business. They reset on the first of each month.\n## What spends a credit\nCreating a form — that is, asking for a new draft — spends one credit.\n## What is free\nRewriting copy, writing logic rules, suggesting a theme, summarising responses, and ordinary conversation with the assistant all cost nothing.\n## Working from a brief\nOn Pro and Business, Ask Formkit can also build from a pasted brief, an uploaded document or one of your existing forms.\n## The limit\nSettings → Plan shows how many you have used. When you reach the limit, the assistant still talks and still does the free work — only new form drafts wait for the reset, or for an upgrade."
      }
    ]
  },
  {
    "id": "account",
    "name": "Account and privacy",
    "icon": "shield",
    "desc": "Your account, your respondents’ data, and keeping junk out of the inbox.",
    "articles": [
      {
        "id": "account-basics",
        "title": "Your account",
        "summary": "Name, email, sign-in and what you see across the app.",
        "body": "Settings → Account holds your name, your email address and your password. The name is what collaborators see on invitations and comments.\n## Language\nFormkit forms are English (US) only for now. The language picker was removed rather than left in place offering translations that do not exist.\n## Formkit is free\nThere are no plans, no prices and no billing page. Every feature described in this help center is available to every account, with the single exception of AI form building, which is enabled per account by an administrator.\n## Signing out\nSign out from the account menu in the top right."
      },
      {
        "id": "data",
        "title": "Data, retention and deletion",
        "summary": "What Formkit stores, and how to get rid of it.",
        "body": "## What is stored\nResponses, uploaded files, the forms themselves and the email log of everything Formkit has sent on your behalf.\n## Deleting responses\nDelete individual responses from the drawer, or in bulk from the responses table. Deletion is immediate and permanent — there is no bin to restore from.\n## Deleting a form\nDeleting a form deletes its responses with it. The confirmation says how many you are about to lose.\n## Deleting your account\nSettings → Account → Delete account removes your account, your forms, your responses and your uploaded files. Type the confirmation phrase and it cannot be undone.\n> Read the privacy notice for the full picture of what is held and for how long."
      },
      {
        "id": "spam",
        "title": "Spam protection",
        "summary": "Keeping bots out of a public form.",
        "body": "Public forms attract automated submissions. Formkit applies two defences, both in form settings.\n## Spam check\nAn invisible check on submission. Genuine respondents never see it; obvious bots are refused. It is on by default for published forms.\n## Rate limiting\nCaps how many submissions can arrive from the same source in a short window. A form linked from a newsletter will never touch the cap; a form being hammered will.\n## If something slips through\nDelete it from the responses table and mark the pattern — a repeated address or a nonsense answer in the same field — so you can filter for it next time."
      }
    ]
  },
  {
    "id": "plans",
    "name": "Plans and billing",
    "icon": "credit-card",
    "desc": "Free, Pro and Business: what each includes, and paying, changing or cancelling.",
    "articles": [
      {
        "id": "plans-overview",
        "title": "Free, Pro and Business",
        "summary": "What each plan includes, and how a form decides which features it has.",
        "body": "Formkit has three plans. Free is the whole product for one person, with no time limit; Pro and Business add to it.\n## Free\nUnlimited forms and responses, every question type, pages and logic, themes, your own formkit.app link, embedding, notifications and confirmation emails, CSV export, core analytics, two collaborators on each form and 5 Ask Formkit credits a month.\n## Pro — $3 a month, or $35 a year\nYour own domain, no “Made with Formkit”, emails from your own domain, custom fonts and CSS, partial responses, sources, devices and drop-off, calculations, hidden fields, answer piping and redirects, webhooks, Zapier, Make, Slack and Google Sheets, payments with your own Stripe, Excel export, and 50 AI credits.\n## Business — $10 a month, or $99 a year\nEverything in Pro, plus a team with unlimited seats, several companies and brands, shared templates, approval before publishing, an audit log, data retention rules, API access, sign-in with your company’s Google or Microsoft, priority support and 200 AI credits.\n## Whose plan counts\nA form uses its owner’s plan. If a Pro owner invites you to their form, you work on it with Pro features, whatever plan you are on yourself.\n> Features that are part of a paid plan show a small Pro or Business label. Using one on Free opens a short sheet to upgrade."
      },
      {
        "id": "billing",
        "title": "Paying, changing and cancelling",
        "summary": "Checkout, receipts, switching plans and what a downgrade does.",
        "body": "Upgrade from Settings → Plan, or from any Pro label in the app. Payment is handled by Polar, who act as the merchant of record: they take the card, add any sales tax or VAT, and send the receipt.\n## Receipts and your card\nSettings → Plan → Invoices and billing opens Polar’s page for your account, with every receipt and the card on file.\n## Switching plans\nMove between Pro and Business, or between monthly and yearly, from the same page. Polar works out the difference for the rest of the period.\n## Cancelling\nCancel any time. The plan stays on until the end of the period you have paid for and is not charged again.\n## What a downgrade does\nNothing is deleted. Features outside your new plan stop — a custom domain goes back to your formkit.app link, the “Made with Formkit” credit comes back — and everything you built or collected stays yours and exportable. Upgrade again and they come back as they were."
      }
    ]
  },
  {
    "id": "connect",
    "name": "Connections and payments",
    "icon": "share-2",
    "desc": "Send responses to other tools as they arrive, and take payment when a form is sent.",
    "articles": [
      {
        "id": "webhooks",
        "title": "Webhooks, Zapier and Make",
        "summary": "Every new response, as JSON, to an address of yours — signed so you know it came from Formkit.",
        "body": "Open a form's Settings → Connections and choose Webhook. Paste the address that should receive each response. Zapier's “Catch Hook” trigger and Make's “Custom webhook” module both give you one.\n## What arrives\nA POST with the form, the respondent, every answer with its question and key, the calculations and any payment. The Formkit-Event header says response.created, response.paid or response.test.\n## Checking the signature\nWhen you add a webhook you are shown its secret once. Each delivery carries Formkit-Signature: t=…,v1=…, an HMAC-SHA256 of the timestamp and the body. The API page has code for checking it.\n## When a delivery fails\nFormkit tries again after a minute, then after ten. Recent deliveries — and what the other end answered — are listed under the connection. Send a test to set things up before real answers arrive.\n> Connections are part of Pro."
      },
      {
        "id": "slack",
        "title": "Post new responses to Slack",
        "summary": "A short message in a channel for each response.",
        "body": "In Slack, add the Incoming Webhooks app to the channel you want and copy the address it gives you. It starts https://hooks.slack.com/services/.\nIn a form's Settings → Connections, choose Slack and paste it. Each new response posts its first few answers; a payment posts a line of its own.\n> Slack is part of Pro."
      },
      {
        "id": "google-sheets",
        "title": "Keep a Google Sheet up to date",
        "summary": "A private link your sheet pulls from — nothing to authorise.",
        "body": "In a form's Settings → Connections, choose Google Sheets. Formkit makes a private link to the form's responses.\n## The quick way\nIn any cell of a sheet, type the =IMPORTDATA(\"…\") formula shown. Google refreshes it about once an hour.\n## Every few minutes\nUse the Apps Script instead: Extensions → Apps Script, paste the script Formkit gives you, then add a time-driven trigger.\n## Keep it private\nAnyone with the link can read the responses. If it gets out, make a new link — the old one stops working at once.\n> Google Sheets is part of Pro."
      },
      {
        "id": "payments",
        "title": "Take a payment with a form",
        "summary": "People pay through your own Stripe account after they send the form.",
        "body": "Formkit never holds the money: payments go straight to your Stripe account, and Formkit takes no cut.\n## Connect Stripe\nIn Stripe, open Developers → API keys → Create restricted key. Give it Write access to Checkout Sessions and nothing else. Paste it in a form's Settings → Payments. A test key (rk_test_…) lets you try it without real money.\n## Set the amount\nCharge a fixed amount, or the result of one of the form's calculations — a quote that adds up the options someone picked, say.\n## What people see\nAfter sending the form they go to Stripe's checkout, then back to a page confirming the payment. Their answers are saved first, so a closed tab never loses them.\n## In your responses\nEach response shows Paid, Awaiting payment or Not paid, and exports gain a Payment column. Refunds are made in Stripe.\n> Payments are part of Pro."
      }
    ]
  },
  {
    "id": "business",
    "name": "Teams and controls",
    "icon": "building-2",
    "desc": "Business: a whole team on every form, approvals, the audit log, retention, the API and single sign-on.",
    "articles": [
      {
        "id": "team",
        "title": "Add your team",
        "summary": "People who work on every one of your forms, as Admin, Editor or Viewer.",
        "body": "Settings → Team. Add people by email address, as many as you like. They join as soon as they sign in with that address, and your forms appear in their list under Shared.\n- Admin: every form, plus the team, approvals and the controls.\n- Editor: edits every form and reads its responses.\n- Viewer: reads every form and its responses.\nInviting someone to a single form still works on any plan, from the form's Share panel.\n> Teams are part of Business. If the plan ends, members lose access to your forms."
      },
      {
        "id": "approvals",
        "title": "Approvals before publishing",
        "summary": "Editors ask; you or an Admin approve, and approving publishes.",
        "body": "Turn it on in Settings → Team. From then on, anyone who is not you or a team Admin sees Ask for approval where Publish was, with room for a note.\nYou and your Admins hear about each request, and the form's Publish dialog shows Approve and publish or Send back. Sending it back tells the person why."
      },
      {
        "id": "audit-retention",
        "title": "Audit log and data retention",
        "summary": "Who did what, and responses that erase themselves when they are old enough.",
        "body": "## Audit log\nSettings → Controls lists publishing, approvals, team changes, API keys, sign-in rules and retention — who, what and when — kept for a year.\n## Data retention\nChoose how long responses are kept: 30 days to two years, or until you delete them. Older responses, and the files uploaded with them, are erased every hour. It cannot be undone, so export first if you need a copy."
      },
      {
        "id": "api",
        "title": "The Formkit API",
        "summary": "Read your forms and responses from your own code.",
        "body": "Make a key in Settings → Controls → API keys; it is shown once. Send it as Authorization: Bearer fk_live_… to https://formkit.app/api/v1.\nThe API is read-only: list forms, get a form's questions, page through its responses and fetch one response. The full reference, with examples, is at formkit.app/api-docs."
      },
      {
        "id": "sso",
        "title": "Single sign-on for your domain",
        "summary": "Everyone at your company signs in with Google or Microsoft.",
        "body": "Settings → Controls → Single sign-on. Enter your company's email domain and add the TXT record shown where its DNS is managed, then check.\nOnce the domain is verified, turn on Require. Anyone with an address at that domain then signs in with Google or Microsoft; the password form turns them away. Someone removed from your company's directory can no longer get in.\n> Sign in once with Google or Microsoft yourself before requiring it, so you are not locked out."
      },
      {
        "id": "dpa-support",
        "title": "DPA and priority support",
        "summary": "The paperwork, and getting a person quickly.",
        "body": "The data processing agreement is at formkit.app/dpa and is included with Business. If you need a countersigned copy, ask support.\nContact support from Settings → Controls. Business messages go to the top of the queue and are answered within one business day."
      }
    ]
  },
  {
    "id": "trouble",
    "name": "Troubleshooting",
    "icon": "life-buoy",
    "desc": "The things that go wrong most often, and what to check first.",
    "articles": [
      {
        "id": "cannot-publish",
        "title": "My form will not publish",
        "summary": "The three things that block a publish.",
        "body": "- The form has no questions. A welcome screen on its own is not publishable.\n- A logic rule points at a question that has been deleted. Open the Logic tab; the broken rule is flagged, and deleting or repointing it clears the block.\n- You are in support view. If the dark banner is across the top of the screen, somebody is viewing your account read-only and every change is refused. Close the banner to leave it.\n## Still stuck\nCheck the publish modal itself. It lists what is missing above the confirm button rather than failing silently."
      },
      {
        "id": "no-responses",
        "title": "Responses are not arriving",
        "summary": "Work through this in order.",
        "body": "## Is the form published?\nA draft link does not accept answers. The builder header shows the state.\n## Is it closed?\nA closed form shows your closing message instead of the questions. Reopen it from the same menu.\n## Are you looking at the right filter?\nThe responses table remembers its filter. Set it to All.\n## Is the email notification on?\nAnswers can be arriving while the alert is off. Check the inbox before assuming the form is broken.\n## Did the link change?\nClaiming a handle or editing the slug changes the public URL, and anyone holding the old link gets nothing. Re-share the current link from the Share modal."
      },
      {
        "id": "embed-blank",
        "title": "My embed shows nothing",
        "summary": "A blank iframe almost always means one of three things.",
        "body": "- The form is not published. An embed of a draft renders empty.\n- The snippet was pasted into a rich-text editor that strips iframes and script tags. Paste it into a raw HTML or custom code block instead.\n- The container has no height. An inline embed fills its parent; if the parent is zero pixels tall, so is the form.\n## Testing it\nOpen the public link directly in a browser. If the form loads there, the problem is the page it is embedded in, not the form."
      },
      {
        "id": "cannot-open",
        "title": "Someone cannot open my form",
        "summary": "What respondents see when something is wrong on your side.",
        "body": "## \"This form is not available\"\nThe form is a draft, or it has been unpublished. Publish it and the link works again.\n## The closing message\nThe form is closed. Reopen it to take answers again.\n## A page that does not load at all\nThe link is wrong. Compare it against the link in the Share modal, character for character — a changed handle or slug is the usual cause.\n## It works for you but not for them\nYou are signed in and they are not. Open the public link in a private window to see exactly what a respondent sees."
      }
    ]
  }
];

export const HELP_ARTICLES: (HelpArticle & { category: HelpCategory })[] =
  HELP_CATEGORIES.flatMap((category) =>
    category.articles.map((a) => ({ ...a, category })),
  );

export function helpArticle(id: string) {
  return HELP_ARTICLES.find((a) => a.id === id) ?? null;
}
