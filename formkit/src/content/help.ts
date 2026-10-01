/**
 * The help centre, by category.
 *
 * Content lifted verbatim from the design handoff. Each article gets its own
 * indexable route at /help/<id> rather than the hash routing the prototype
 * used, so every article is its own page for search engines.
 *
 * Article bodies are a small Markdown subset: "## " headings, "- " bullets,
 * "> " callouts, and blank-line-separated paragraphs. See HelpArticleBody.
 */

export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  /** When this article last changed (YYYY-MM-DD), shown on the page and in the sitemap. */
  updated?: string;
  /** Articles to suggest after this one; otherwise its neighbours in the category. */
  related?: string[];
};

export type HelpCategory = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** The task it sits under on the help centre's front page. */
  group: string;
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
        "body": "Everything starts on the dashboard. Select Create form in the top right and choose how to begin: a blank form, one of the templates, or a duplicate of something you have already built.\n## Name it\nGive the form a name when you create it. The name is what you and your collaborators see on the dashboard, and it becomes the default title respondents see at the top of the form. You can change it at any time in Design.\n## Add questions\nThe builder opens with an empty canvas and the field library on the left. Select a field type to add it to the end, or drag it onto the canvas to drop it exactly where you want. Each question card holds the question text, optional help text, and a Required toggle.\n## Save\nThere is no save button. Every change is written as you make it, and the header shows when it was last saved.\n> A form stays a draft until you publish it. Nobody can open the link before that.",
        "updated": "2026-09-22"
      },
      {
        "id": "form-anatomy",
        "title": "What a form is made of",
        "summary": "Questions, pages, logic, theme and settings, and which panel owns each one.",
        "body": "A Formkit form has five parts, and each has its own tab in the builder.\n- Build is the questions themselves: fields, help text, options and page breaks.\n- Design is the look: theme, colours, type and logo.\n- Logic is the rules that skip people past questions they do not need.\n- Settings covers who the form belongs to and its links, notifications, the closing message, spam protection and the redirect after submit.\n- Responses is everything that comes back.\n## The welcome screen\nEvery form opens with a welcome screen showing the title and an optional description. It is the first card on the canvas and cannot be deleted, but you can leave the description empty and it will not render.\n## Pages\nA page break splits the form in two. Respondents see a progress indicator and move between pages with Back and Next. Without a page break, the whole form is one scroll.",
        "updated": "2026-09-30"
      },
      {
        "id": "publish-share",
        "title": "Publish, close and unpublish",
        "summary": "Three different states, and what each one does to your link.",
        "body": "## Publish\nPublishing makes the form live at its public link and starts accepting answers. Select Publish in the builder header, check the summary, and confirm. If you have edited a live form, the modal tells you how many changes are waiting to go out.\n## Close\nClosing a published form stops new answers but leaves the link working. People who open it see your closing message instead of the questions. Use it for a deadline, an event that filled up, or an application window that ended.\n## Unpublish\nUnpublishing takes the form back to draft. The link stops working entirely. Every response you have already collected is kept.\n> There is no on/off switch on the link itself. Closing or unpublishing is how you stop answers.",
        "updated": "2026-09-28"
      },
      {
        "id": "version-history",
        "title": "Version history",
        "summary": "Every publish is a snapshot you can read and restore.",
        "body": "Each time you publish, Formkit takes a snapshot of the questions as they were. Open Version history from the form actions menu to see them, newest first, with the date and who published.\n## Restoring\nRestoring a version puts those questions back on the canvas. Your current questions are snapshotted first, so restoring is itself undoable. Restoring does not publish, so you will see the amber \"unpublished changes\" note until you do.\n## Unpublished changes\nThe builder counts edits made since the live version. The publish modal shows that count so you always know whether respondents are seeing your latest work.\n## How far back\nFree keeps the last 30 days of published versions, Pro a year, and Business all of them. Older versions are still stored. Upgrade and they come back into the list.",
        "updated": "2026-09-28"
      }
    ],
    "group": "Build your form"
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
        "body": "## Adding\nSelect a field type in the library to append it, or drag the tile onto the canvas and drop it between two existing cards. The blue line shows where it will land. Hovering the gap between two cards also reveals a small insert point. Select it to add a field in that exact position.\n## Reordering\nDrag a question card up or down. Press anywhere on the card that is not an input or a button, or use the grip in the card's toolbar, then drop it where the blue line shows. The card menu also has Move up and Move down if you prefer not to drag.\n## Duplicating and deleting\nEvery card has Duplicate and Delete in its toolbar. Duplicating copies the question text, options and required state. Deleting is immediate, and a toast offers an undo.\n> Deleting a question that a logic rule points at also removes that rule.",
        "updated": "2026-09-28"
      },
      {
        "id": "field-types",
        "title": "Field types",
        "summary": "What each field collects and when to reach for it.",
        "body": "The library groups fields by what they collect.\n- Contact: name, email, phone, company, website, address. These validate their format, so a mistyped address is caught before submission.\n- Text: short text for a line, long text for a paragraph, and number.\n- Time: date and time.\n- Choice: dropdown, single choice, multiple choice, yes/no.\n- Rating: stars out of five, or an opinion scale.\n- Upload: a file, a signature (they type their full name), or a voice recording they make in the browser.\n- Smart: a hidden field, filled from the link (Pro).\n## Options\nChoice fields hold a list of options you edit in place. Press Enter to add the next one. A dropdown with more than about eight options is easier to fill in than a long list of radio buttons.\n## Help text\nEvery field takes optional help text below the question. Use it for the thing people always ask about, such as the format of a reference number, or what you mean by \"budget\".",
        "updated": "2026-10-01"
      },
      {
        "id": "required-fields",
        "title": "Required fields and validation",
        "summary": "Asking for an answer without making the form feel like a form.",
        "body": "Toggle Required on any question and it is marked with an asterisk. Respondents cannot move to the next page, or submit, until it has an answer.\n## Be sparing\nA form where everything is required is a form people abandon. Mark the fields you cannot act without (usually a contact address and one or two specifics) and leave the rest optional.\n## What is validated automatically\nEmail, phone, website and number fields check their own format. The message names the fix rather than just refusing: \"That address is missing a domain\".\n## Errors on submit\nIf a required field is empty, the form scrolls to the first one and highlights it. On a multi-page form the check runs per page, so nobody reaches the end and discovers a problem three pages back.",
        "updated": "2026-09-28"
      },
      {
        "id": "pages",
        "title": "Pages and page breaks",
        "summary": "Splitting a long form so it does not read like a tax return.",
        "body": "Add a page break from the library or the insert point. It appears on the canvas as a full-width divider card with the page name, and everything below it until the next break is that page.\n## Naming pages\nName a page and the name shows in the builder's page list, in logic rules and in the respondent's progress indicator. Unnamed pages are numbered.\n## Reordering pages\nThe page list on the right of the canvas can be dragged to reorder whole pages at once, questions and all. Dragging the divider card on the canvas does the same thing.\n## How long is too long\nFive to seven questions per page reads comfortably. If a page needs a scroll on a phone, it is a candidate for splitting.",
        "updated": "2026-09-22"
      },
      {
        "id": "file-uploads",
        "title": "File uploads",
        "summary": "Collecting documents, and the limits that apply.",
        "body": "Add a File upload field and respondents get a drop zone they can drag onto or select to browse.\n## Size\nEach file can be up to 20 MB on Free, 150 MB on Pro and 250 MB on Business. The plan of the form's company decides. The limit is shown to the respondent under the drop zone, so nobody wastes time on a file that will be refused.\n## Accepted types\nLeave the accepted list blank to take anything. Otherwise, list extensions such as .pdf .png .docx and the picker filters to those.\n## Where files go\nUploaded files are attached to the response. Open the response in the inbox to download them. In a CSV or Excel export, each file is a link in its question's column rather than the file itself.\n> To collect a spoken answer instead of a file, use a Voice recording field.",
        "updated": "2026-10-01"
      },
      {
        "id": "voice-recording",
        "title": "Voice recordings",
        "summary": "Let people answer out loud, for up to five minutes.",
        "body": "Add a Voice recording field from the Upload group in the library. The people answering press the button, speak, and stop. They can listen back and record again before they send the form.\n## How long\nSelect the question and choose Longest recording: 15 seconds, 30 seconds, 1 minute, 2 minutes, 3 minutes or 5 minutes. A timer shows how long is left, and the recording stops by itself when it reaches the limit.\n## The microphone\nThe browser asks for permission to use the microphone the first time. If it is blocked, or there is no microphone, the question offers to upload an audio file instead, so it can always be answered.\n## Size\nRecordings count as uploads, so the plan's upload size applies: 20 MB on Free, 150 MB on Pro and 250 MB on Business. A five-minute recording is around 3 MB, well inside every plan.\n## Listening to answers\nOpen the response in the inbox and the recording plays right under its question. Download it from the same place. In a CSV or Excel export, each recording is a link.\n## Required and logic\nMark it required and the form will not go on until there is a recording. In logic, a voice question can be checked for whether it was answered.\n> Voice recording is on every plan.",
        "updated": "2026-10-01"
      }
    ],
    "group": "Build your form"
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
        "body": "Open the Logic tab and select Add rule. Every rule reads the same way: when a question has a particular answer, do something to a question or a page.\n## The parts\n- When: the question being watched.\n- Is: the answer that triggers the rule.\n- Then: show, hide or skip to.\n- Target: the question or page it applies to.\n## Order\nRules run top to bottom, and the first match wins. Drag a rule up the list to give it priority.\n## Naming\nGive a rule a name, like \"Skip pricing for existing clients\", and the list stays readable six months from now.\n> Logic only works on questions that come before the target. A rule cannot depend on an answer nobody has given yet.",
        "updated": "2026-09-28"
      },
      {
        "id": "logic-skip",
        "title": "Skip to a page",
        "summary": "Sending people down a branch and past what does not apply.",
        "body": "Skip rules are the fastest way to make one form serve two audiences. Ask which kind of enquiry it is on page one, then skip each answer to the page that fits.\n## Set it up\nCreate a rule with Then set to Skip to, and choose a page as the target. Anyone matching the answer jumps straight there when they select Next.\n## Dead ends\nPages that can only be reached by a skip should end with a skip of their own, or people will fall through into the next branch. The Logic tab flags a page that has no way out.\n## Checking it\nUse Preview and walk each branch. The preview honours every rule, so a wrong turn shows up immediately.",
        "updated": "2026-09-22"
      },
      {
        "id": "logic-show-hide",
        "title": "Show or hide a question",
        "summary": "Conditional questions that appear only when they are relevant.",
        "body": "A show rule keeps a question hidden until its condition is met; a hide rule does the opposite. Use show for follow-ups (\"You said other; what was it?\") and hide for questions that stop applying.\n## Behaviour on the page\nHidden questions are not rendered at all, so they do not leave a gap, and they never count towards required validation while hidden.\n## In the responses\nA question somebody never saw is recorded as blank rather than skipped, and the responses table shows an em dash in that column.\n## Keep it shallow\nTwo levels of conditional depth is usually the limit before a form becomes hard to reason about. Beyond that, a page break and a skip rule is clearer.",
        "updated": "2026-09-28"
      },
      {
        "id": "logic-groups",
        "title": "Groups, comparisons and endings",
        "summary": "“(This and that) or something else”, several endings, hidden options and limited places.",
        "body": "A rule can hold more than one group of conditions. Each group joins its own conditions with AND or OR, and the groups are joined the same way. So “(budget over £20k and a company email) or they asked for a call” is one rule. Select Add a group under a rule's conditions.\n## Comparisons\nThe comparisons follow the question: choice questions offer is, is not, is any of and is none of; numbers offer at least, at most and between; dates offer on, before, after and between; text offers contains, starts with, ends with, email domain and a pattern. A condition can also read a calculation's result.\n## Several endings\nUnder Endings, add a different last screen, say one for people who qualify and one for those who don't, and finish on it with a rule's End with. Each ending can have its own button, or send people straight to a page.\n## Hiding options\nHide options on removes some of a choice question's options when the rule holds, and any it hides are un-picked.\n## Limited places\nIn a choice question's settings, turn on Limit places and type how many people can pick each option: seats, slots or tickets. A full option can't be picked, and the form shows how many places are left.\n> Groups and the new comparisons are on every plan. Several endings, hiding options and limited places are part of Pro.",
        "updated": "2026-09-28"
      },
      {
        "id": "logic-map",
        "title": "The logic map and tester",
        "summary": "See every rule at once, catch mistakes, and try your answers.",
        "body": "At the top of the Logic tab, How it flows shows your pages in order, what each rule does to which question, where people can skip to and where they can end.\n## Checks\nUnderneath, Formkit lists anything that looks wrong: a rule reading a deleted question, a condition with no value, a jump that goes backwards, a rule that reads an answer given after the question it affects, options all hidden, or an ending no rule leads to.\n## Try it\nSwitch to Try it and pick answers. It runs the same rules the live form runs and shows the pages people see, the ones they skip, what is hidden or required, and which ending they reach.",
        "updated": "2026-09-28"
      },
      {
        "id": "logic-ai",
        "title": "AI in your logic",
        "summary": "Describe a rule in plain words, let the AI decide, or pull facts out of answers.",
        "body": "## Describe a rule\nAt the top of the Logic tab, say what should happen in your own words, for example “if the budget is over £20k and they found us on Instagram, skip to the call page”. The AI writes the rules against your questions, and you add the ones you want. Nothing is saved until you do. On every plan.\n## AI decides\nA condition can ask the AI a yes-or-no question about an answer, such as “does this mention a deadline?” or “does this sound unhappy?”. The form asks when that answer's page is finished. Choose what to assume until it answers: if the AI can't answer, or your checks run out, the form goes on with that.\n## Pull a fact into a hidden field\nIn a hidden field's settings, turn on Fill it in with AI, pick the answer it reads and say what to pull out, for example “their budget in pounds, as a number”. The value is saved with the response and can drive rules and calculations.\n## The allowance\nEach response that goes through AI logic counts once towards your company's responses AI works on, however many checks it needs, and the same response is never counted twice. Settings → Plan shows how many are left. Once they run out, AI credits keep it going, 1 credit a response.\n> Describing a rule is on every plan. AI decisions and facts are part of Pro.",
        "updated": "2026-09-29"
      }
    ],
    "group": "Build your form"
  },
  {
    "id": "ai",
    "name": "Building with AI",
    "icon": "sparkles",
    "desc": "Ask Formkit writes a form from a description. Where it is available, and what it costs.",
    "articles": [
      {
        "id": "ai-what",
        "title": "What Ask Formkit does",
        "summary": "Describe the form you need and it drafts the questions.",
        "body": "Ask Formkit turns a description into a working draft: fields of the right type, in a sensible order, with your wording tightened rather than replaced.\n## What you can ask for\n- A new form from a sentence: \"an intake form for a branding project, with budget and timeline\".\n- On Pro and Business, a form from a brief you paste, a document you upload or one of your existing forms.\n- A rewrite of the copy on a form you have already built.\n- Logic: describe the branch and it writes the rules.\n- A theme suggestion based on a brand description.\n- A summary of what a batch of responses says.\n## It drafts, you decide\nEverything it produces lands on the canvas as an ordinary draft. Edit it, delete half of it, publish it. It is your form from the moment it appears.",
        "updated": "2026-09-30"
      },
      {
        "id": "ai-access",
        "title": "Why can I not see Ask Formkit?",
        "summary": "It is on for every account, unless it has been paused or turned off for yours.",
        "body": "Ask Formkit is on for every account, on every plan. The launcher sits in the app chrome and the Ask workspace is under its own tab.\n## If you cannot see it\nA Formkit administrator can turn it off for one account, for example after misuse. When it is off, nothing about it appears in the app. Write to support if you think that has happened by mistake.\n## If it is paused\nOccasionally the whole feature is paused across the platform, for maintenance or a model change. When the pause lifts, it comes back for everyone, with the allowance and credits you had left.",
        "updated": "2026-09-29"
      },
      {
        "id": "ai-credits",
        "title": "AI allowance and credits",
        "summary": "What each plan includes a month, and what credits cover once it runs out.",
        "body": "Every company has a monthly AI allowance, shared by everyone in it. It refills on the first of each month.\n## The allowance, per seat\n- New forms built by AI: 3 on Free, 50 on Pro, 200 on Business.\n- AI edits to questions, logic and themes: 10 on Free, 25 on Pro, 50 on Business.\n- Responses AI works on (replies, AI logic and pulled facts): 20 on Pro, 50 on Business.\n- AI insights reports: 3 on Pro, 10 on Business.\nOn Pro and Business each seat adds its allowance to one pool, so a Pro company of three has 150 builds a month for whoever needs them. A Free company has its allowance once, however many members it has.\n## What is free\nOrdinary conversation with the assistant, and asking it questions about Formkit, never count.\n## AI credits\nOnce a month's allowance is used, AI credits keep things going. A form build is 2 credits, an edit 1, a response AI works on 1 and an insights report 3. Packs are $5 for 100, $20 for 420 and $50 for 1,050, bought under Settings → Plan by the company's owner or an admin. Credits belong to the company, are only used after the allowance, and last 12 months. Free companies can use them for builds and edits.\n## Working from a brief\nOn Pro and Business, Ask Formkit can also build from a pasted brief, an uploaded document or one of your existing forms.",
        "updated": "2026-09-29",
        "related": [
          "ai-what",
          "seats",
          "plans-overview"
        ]
      }
    ],
    "group": "Build your form"
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
        "body": "The Design tab opens on the theme presets. Each one sets the background, the card surface, the accent used by buttons and selected states, and the type pairing. Selecting a preset updates the live preview beside it straight away.\n## Starting from a preset\nPresets are a starting point, not a lock. Change any individual colour afterwards and the preset becomes \"Custom\" without losing the rest of its choices.\n## Matching a brand\nIf you have brand colours, set the accent first and the background second. A dark background needs a lighter accent than the same brand would use on white. The preview shows the contrast as you go.",
        "updated": "2026-09-28"
      },
      {
        "id": "colours-type",
        "title": "Colours, type and layout",
        "summary": "The individual controls behind a theme.",
        "body": "## Colours\nFour colours make up a theme: page background, card surface, accent and text. Each has a swatch row of suggestions plus a hex field. Error colouring is recalculated for you so a dark theme stays legible.\n## Type\nPick a font for the form from the picker. Serif families suit long-form applications; the sans families suit short enquiries. Formkit does not offer monospace faces.\n## Layout\nChoose classic, where every question is on one page, or conversational, where questions arrive one at a time with a sticky submit. Conversational suits phones and short forms; classic suits anything somebody needs to review before sending.\n## Your own font and CSS (Pro)\nOn Pro and Business, upload your brand's font file under Type, and add your own CSS in the CSS section of Design. The CSS applies only inside the form, so it cannot change anything else on the page.",
        "updated": "2026-09-28"
      },
      {
        "id": "logos",
        "title": "Logos and lockups",
        "summary": "Adding your mark, and which one shows when you have several.",
        "body": "Upload a logo in Design and it appears above the form title. A second logo creates a lockup: two marks side by side, separated by a hairline. That is how a collaboration or a client project is usually presented.\n## Order\nDrag the logo rows to reorder them. The first is yours; anything after it sits to the right.\n## Which logo appears\nA form published under a company uses that company's logo unless you override it here. A form published as yourself uses whatever you upload on the form itself.\n## Sizing\nLogos are scaled to a fixed height, so supply artwork with transparent padding trimmed off or it will look smaller than the others in the lockup.",
        "updated": "2026-09-28"
      }
    ],
    "group": "Build your form"
  },
  {
    "id": "share",
    "name": "Sharing and embedding",
    "icon": "share-2",
    "desc": "Links, embeds and QR codes: the ways to put a form in front of people.",
    "articles": [
      {
        "id": "share-link",
        "title": "Share a link",
        "summary": "Where the public URL comes from and how to change it.",
        "body": "Open Share from the builder header. The modal shows the form's public link, ready to copy.\n## What the link looks like\nBy default it is formkit.app/f/your-form. If you have claimed a handle, for yourself or for the company the form is published under, the link becomes formkit.app/your-handle/your-form.\n## The slug\nThe last part of the link comes from the form name and can be edited in form settings. Changing it breaks the old link, so change it before you send anything out, not after.\n> The Share modal has no link on/off switch. To stop answers, close or unpublish the form.",
        "updated": "2026-09-28"
      },
      {
        "id": "embed",
        "title": "Embed a form",
        "summary": "Three ways to put a form inside your own site.",
        "body": "The Share modal's Embed tab gives you a snippet to paste into your site's HTML. Three modes:\n- Inline puts the form in the flow of the page, in an iframe that fills its container.\n- Popup adds a button that opens the form over your page.\n- Full screen takes over the window when triggered.\n## Height\nInline embeds are 720 pixels tall by default. Change the height in the snippet, or let a long form scroll inside its frame.\n## Styling\nThe embedded form uses its own theme, not your site's CSS. Match them by setting the form background to the same colour as the section it sits in.",
        "updated": "2026-09-22"
      },
      {
        "id": "qr-code",
        "title": "QR codes",
        "summary": "For print, packaging, events and anywhere there is no link to click.",
        "body": "Every published form has a QR code, generated from its public link, in the Share modal. Download it as a PNG and place it on a poster, a table card, an invoice or a package insert.\n## Print size\nPrint it at 2 cm square or larger for a code people scan from arm's length; larger again for a poster read from across a room.\n## If the link changes\nThe code encodes the current URL. Claiming a handle or changing the slug changes that URL, so download a fresh code afterwards and reprint.",
        "updated": "2026-09-22"
      }
    ],
    "group": "Share it and collect answers"
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
        "body": "The Responses tab lists everything the form has collected, newest first. Each row shows the time, the first couple of answers and a status badge.\n## The drawer\nSelect a row to open the full response beside the list. It shows every question and answer in order, any uploaded files, and the time taken.\n## Filtering\nFilter by completion (all, complete or partial) and search across answers. The counts above the table update with the filter, so you always know what you are looking at.\n## Marking as reviewed\nMark a response reviewed once you have acted on it. Reviewed rows drop their badge but stay in the list.",
        "updated": "2026-09-28"
      },
      {
        "id": "partials",
        "title": "Partial responses",
        "summary": "People who started and stopped, and what you can do about it.",
        "body": "A partial response is one where somebody answered at least one question and left without submitting. Formkit keeps them, badged as partial with the number of questions answered.\n## Where they show up\nPartials are excluded from the Completed count and from the completion rate, so your headline numbers stay honest. Use the All / Complete / Partial control to see them.\n## Resuming\nEach partial has a resume link in its drawer. Send it to the respondent and they pick up where they stopped, with their answers still there.\n## Reading them as signal\nA cluster of partials that all stop at the same question usually means that question is the problem. It may be too personal, too vague or too much work.\n> Partial responses are kept on every plan, Free included.",
        "updated": "2026-09-28"
      },
      {
        "id": "export-responses",
        "title": "Export to CSV or Excel",
        "summary": "Getting the data out for a spreadsheet or another tool.",
        "body": "Select Export above the responses table and choose CSV or Excel. The file downloads immediately.\n## What is in it\nOne row per response, one column per question, in canvas order, plus the submitted time and the completion status. Uploaded files appear as links.\n## Filters carry over\nThe export respects whatever filter is applied. Filter to complete responses from this month and that is exactly what you get.\n## Selected rows only\nIf you have selected rows with the checkboxes, the export offers those rows on their own.\n## CSV and Excel\nCSV is on every plan. Excel, and having a copy of every response emailed to you, are on Pro and Business.\n## Extra columns\nForms with calculations get a column for each result, and forms that take payment get a Payment column with the amount and whether it was paid.",
        "updated": "2026-09-28"
      },
      {
        "id": "bulk-actions",
        "title": "Bulk actions",
        "summary": "Doing the same thing to twenty responses at once.",
        "body": "Select rows with their checkboxes and a dark action bar appears at the bottom of the screen with the count and the available actions.\n- Mark reviewed clears the badge on every selected row.\n- Export writes just the selection to a file.\n- Delete removes them. This cannot be undone, and the confirmation says how many.\n## Selecting everything\nThe checkbox in the table header selects everything matching the current filter, not just the rows on screen. The action bar tells you which it is.",
        "updated": "2026-09-22"
      }
    ],
    "group": "Share it and collect answers"
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
        "body": "Notifications are set per form, in Settings. Turn on the response alert and choose where it goes: your own address by default, or any other.\n## Subject and body\nBoth are editable and both accept variables: the form name, the submission time, and any question's answer. A subject like \"New enquiry from {{name}}\" is far easier to triage in a mailbox than \"You have a new response\".\n## Turning it off\nA busy form can produce more email than anyone wants. Switch the alert off and read the inbox instead; nothing is lost either way.",
        "updated": "2026-09-28"
      },
      {
        "id": "notify-routing",
        "title": "Route by answer",
        "summary": "Sending different responses to different people.",
        "body": "Under the notification settings, add a routing rule: when a question has a particular answer, send the alert to a particular address instead.\n## First match wins\nRules are evaluated top to bottom and the first match decides where the email goes. Order them from most specific to least.\n## A worked example\nA support form asks \"What is this about?\" with options for billing, technical and something else. Three rules send each to the right inbox, and anything that matches nothing falls back to the default address.\n> Routing changes who is emailed. It does not change who can read the responses in Formkit. The collaborator roles decide that.",
        "updated": "2026-09-28"
      },
      {
        "id": "notify-respondent",
        "title": "Send a confirmation to the respondent",
        "summary": "The receipt people expect after filling something in.",
        "body": "Turn on the respondent confirmation and Formkit emails whoever submitted, using the email field on the form.\n## What to write\nKeep it short: confirm what they sent, say what happens next and by when. A confirmation that says nothing but \"thank you\" generates a follow-up email asking whether it arrived.\n## Reply-to\nSet a reply-to address so replies reach a person rather than disappearing.\n## Attaching a copy\nOptionally attach a copy of their answers. Useful for applications and quotes, unnecessary for a two-question enquiry.\n## The email log\nEverything Formkit sends on your behalf is recorded in the email log in Settings, with the recipient, the subject and the time.",
        "updated": "2026-09-22"
      }
    ],
    "group": "Share it and collect answers"
  },
  {
    "id": "companies",
    "name": "Companies and people",
    "icon": "users",
    "desc": "Companies, members and guests, roles, and which company a form belongs to.",
    "articles": [
      {
        "id": "add-company",
        "title": "Companies and switching between them",
        "summary": "Separate workspaces, each with its own forms, members and plan. Make as many as you like.",
        "body": "A company is a workspace: its own forms, responses, brand, members and plan. Everyone starts with a personal company in their own name. Make another when you work for something that is not just you: a studio, a client, a side business.\n## Creating one\nOpen the company menu beside the Formkit logo and choose Create a company. Give it a name; add its logos, a handle and brand colours in Settings → Company. You can have as many companies as you like, on any plan.\n## Switching\nThe same menu lists every company you own or are a member of, with your role and its plan. Pick one and the whole app follows: forms, responses, analytics and settings are that company's.\n## Two logos\nA company has a full logo and a square one. The full logo (your wordmark, or the symbol with the name) sits above the form title and in emails. The square logo (just the symbol) is the browser tab icon on your forms and marks the company around Formkit. Until you add a square one, the full logo is shrunk to fit.\n## Plans\nEach company has its own plan. Upgrading one does not touch the others. See Free, Pro and Business.\n## Deleting one\nThe owner can delete a company from Settings → Company. Its members lose access and its forms go back to the owner's personal company. Nothing is deleted. A company on a paid plan is cancelled first.",
        "updated": "2026-09-30",
        "related": [
          "publish-under",
          "team",
          "claim-handle"
        ]
      },
      {
        "id": "members-guests",
        "title": "Members or guests?",
        "summary": "Who to add to the company, and who to invite to a single form.",
        "body": "There are two ways to let someone work with you, and on a paid plan they cost differently.\n## Members\nA member belongs to the company. They see every form in it, as Admin, Editor or Viewer, and new forms appear for them without an invitation. Add them in Settings → Members. On Free, members are free and unlimited. On Pro and Business each member is a seat.\n## Guests\nA guest is invited to one form, from Collaborators in the form’s actions menu, as Editor, Commenter or Viewer. They see that form and nothing else in the company. Guests are never a seat: three on each form on Free, unlimited on Pro and Business.\n## Which to choose\n- Colleagues who work on most of your forms: members.\n- A client reviewing the wording of one form: a guest, as Commenter.\n- A freelancer helping on one project: a guest, as Editor.\n- Someone who only needs the results of one form: a guest, as Viewer.\n## Changing your mind\nRemove a guest and add them as a member, or the other way round. Their comments and changes stay.",
        "related": [
          "team",
          "invite",
          "seats"
        ],
        "updated": "2026-09-30"
      },
      {
        "id": "team",
        "title": "Members of a company",
        "summary": "People who work on every form in a company, as Admin, Editor or Viewer.",
        "body": "Settings → Members, with the company open. Add people by email address, as many as you like, on any plan. They join as soon as they sign in with that address, and the company appears in their company menu.\n- Admin: every form, plus the members, the plan and billing, approvals and the controls.\n- Editor: edits every form and reads its responses.\n- Viewer: reads every form and its responses.\n## Seats\nOn Free, members are free. On Pro and Business every member is a seat, and the bill follows as people join and leave.\n## Leaving\nAnyone can leave a company from Settings → Members. The owner and admins can remove people.\n## Guests\nInviting someone to a single form still works, from Collaborators in the form’s actions menu. See Members or guests? Guests are never a seat: three a form on Free, unlimited on Pro and Business.",
        "updated": "2026-09-30",
        "related": [
          "members-guests",
          "roles",
          "seats"
        ]
      },
      {
        "id": "invite",
        "title": "Invite someone to a form",
        "summary": "Adding a collaborator, and what happens on their side.",
        "body": "Open Collaborators from the form actions menu. Enter an email address, choose a role and send the invitation.\n## Pending invitations\nAn invitation that has not been accepted sits in the pending list, where you can resend or revoke it. Accepting it adds the person to that form, not to your whole account.\n## Per form, not per account\nCollaboration is scoped to a single form. Somebody who edits your enquiry form has no access to anything else you have built until you invite them to that too.\n## Removing\nRemove a collaborator and they lose access immediately. Anything they wrote stays.\n## How many people\nOn Free, three guests can work on each form besides your company's members. On Pro and Business there is no limit. Members of your company work on every one of its forms without being invited to each. See Members of a company.",
        "updated": "2026-09-29",
        "related": [
          "members-guests",
          "roles",
          "comments-activity"
        ]
      },
      {
        "id": "roles",
        "title": "What each role can do",
        "summary": "Editor, Commenter and Viewer, spelled out.",
        "body": "- Editor can change the form (questions, logic, theme and settings), publish it, and read its responses from their own account.\n- Commenter can read the form and leave comments on questions, but cannot change anything.\n- Viewer can see the form and its responses, and nothing else.\n## Choosing\nEditor is for the person building alongside you. Commenter suits a client reviewing wording before launch. Viewer suits somebody who only needs the results.\n> An Editor reads responses. If a form collects anything sensitive, that is the question to ask before handing out the role.",
        "updated": "2026-09-28"
      },
      {
        "id": "comments-activity",
        "title": "Comments and activity",
        "summary": "Discussing a question in place, and seeing what changed.",
        "body": "## Comments\nLeave a comment on any question card and it stays attached to that question. Open comments show a count in the builder header, so a review pass is visible without hunting. Resolve a comment when it has been dealt with.\n## Activity\nThe Activity tab records what happened to the form and when: published, unpublished, questions added or removed, collaborators invited, theme changed. It is per form and cannot be edited.",
        "updated": "2026-09-22"
      },
      {
        "id": "publish-under",
        "title": "Move a form to another company",
        "summary": "Every form belongs to you or to one of your companies. Moving it changes its link, its brand and its plan.",
        "body": "Every form belongs to one company: your personal one, in your own name, or another company you are part of. Its link, logo, brand and plan all come from that company.\n## Moving a form\nOpen the form, then Settings → General → Owner and links, and pick a company under Published under. The same picker is in Design → Branding. It shows when you made the form and belong to at least one company.\n## What changes\n- The link moves to the new company's handle, like formkit.app/studio/intake. Send the new link to anyone who has the old one.\n- The form takes the new company's logo and brand.\n- The form uses the new company's plan. Moving it into a Free company turns off the Pro features it used, and moving it into a Pro company turns them on.\n- The new company's members can work on it.\n## Responses\nResponses move with the form. Nothing is lost or copied.",
        "updated": "2026-09-30",
        "related": [
          "add-company",
          "claim-handle",
          "custom-domain"
        ]
      },
      {
        "id": "claim-handle",
        "title": "Claim your Formkit link",
        "summary": "Turning formkit.app/f/enquiry into formkit.app/your-name/enquiry.",
        "body": "Every company can claim a handle, including your personal one. Open Settings → Company with that company open and choose a handle.\n## What changes\nEvery form in that company moves to formkit.app/handle/form-name. Forms in your other companies use their own handles.\n## Rules\nHandles are unique across Formkit, so two companies can never share one. Letters, numbers and hyphens only.\n## Releasing it\nRelease a handle and the company's links fall back to formkit.app/f/form-name. The handle becomes available to somebody else, so release one only when you are sure.\n## Your own domain (Pro)\nOn Pro and Business you can put a company's forms on a domain of its own, like forms.acme.com, as well as its formkit.app link. See Use your own domain.",
        "updated": "2026-09-30",
        "related": [
          "publish-under",
          "custom-domain",
          "share-link"
        ]
      }
    ],
    "group": "Work as a team"
  },
  {
    "id": "business",
    "name": "Teams and controls",
    "icon": "building-2",
    "desc": "On Business: approvals, the audit log, retention, the API and single sign-on.",
    "articles": [
      {
        "id": "approvals",
        "title": "Approvals before publishing",
        "summary": "Editors ask; you or an Admin approve, and approving publishes.",
        "body": "Turn it on in Settings → Members. From then on, anyone who is not the owner or an Admin sees Ask for approval where Publish was, with room for a note.\nYou and your Admins hear about each request, and the form's Publish dialog shows Approve and publish or Send back. Sending it back tells the person why.",
        "updated": "2026-09-29"
      },
      {
        "id": "audit-retention",
        "title": "Audit log and data retention",
        "summary": "Who did what, and responses that erase themselves when they are old enough.",
        "body": "## Audit log\nSettings → Controls lists publishing, approvals, team changes, API keys, sign-in rules and retention: who did what, and when. Entries are kept for a year.\n## Data retention\nChoose how long responses are kept: 30 days to two years, or until you delete them. Older responses, and the files uploaded with them, are erased every hour. It cannot be undone, so export first if you need a copy.",
        "updated": "2026-09-28"
      },
      {
        "id": "api",
        "title": "The Formkit API",
        "summary": "Read your forms and responses from your own code.",
        "body": "Make a key in Settings → Controls → API keys; it is shown once. Send it as Authorization: Bearer fk_live_… to https://formkit.app/api/v1.\nThe API is read-only: list forms, get a form's questions, page through its responses and fetch one response. The full reference, with examples, is at formkit.app/api-docs.",
        "updated": "2026-09-28"
      },
      {
        "id": "sso",
        "title": "Single sign-on for your domain",
        "summary": "Everyone at your company signs in with Google or Microsoft.",
        "body": "Settings → Controls → Single sign-on. Enter your company's email domain and add the TXT record shown where its DNS is managed, then check.\nOnce the domain is verified, turn on Require. Anyone with an address at that domain then signs in with Google or Microsoft; the password form turns them away. Someone removed from your company's directory can no longer get in.\n> Sign in once with Google or Microsoft yourself before requiring it, so you are not locked out.",
        "updated": "2026-09-28"
      },
      {
        "id": "dpa-support",
        "title": "DPA and priority support",
        "summary": "The paperwork, and getting a person quickly.",
        "body": "The data processing agreement is at formkit.app/dpa and is included with Business. If you need a countersigned copy, ask support.\nContact support from Settings → Controls. Business messages go to the top of the queue and are answered within one business day.",
        "updated": "2026-09-28"
      }
    ],
    "group": "Work as a team"
  },
  {
    "id": "plans",
    "name": "Plans and billing",
    "icon": "credit-card",
    "desc": "Free, Pro and Business, seats, upgrading and switching, auto-renew, cancelling and receipts.",
    "articles": [
      {
        "id": "plans-overview",
        "title": "Free, Pro and Business",
        "summary": "What each plan includes, what a seat is, and how a form decides which features it has.",
        "body": "Formkit has three plans. Free is the whole form builder, with no time limit; Pro and Business add to it. Plans belong to a company, and paid plans are per seat.\n## Free: $0\nUnlimited forms, responses and members, every question type, pages and logic, themes, your own formkit.app link, embedding, notifications and confirmation emails, partial responses, drop-off by question, CSV export, three guests on each form, 20 MB uploads, 30 days of version history, and AI for 3 new forms and 10 edits a month.\n## Pro: $6 a seat a month, or $60 a year\nEverything in Free, plus your own domain, no “Made with Formkit”, emails from your own domain, custom fonts and CSS, where people come from and their devices, calculations, hidden fields, answer piping and redirects, several endings, hidden options and limited places, quizzes and exams, webhooks, Zapier, Make, Slack and Google Sheets, payments with your own Stripe, Excel export, unlimited guests, AI replies, AI logic and AI insights, 150 MB uploads and a year of version history. Each seat adds 50 AI form builds, 25 AI edits, 20 responses AI works on and 3 insights reports a month.\n## Business: $19 a seat a month, or $190 a year\nEverything in Pro, plus shared templates, approval before publishing, an audit log, data retention rules, API access, sign-in with your company’s Google or Microsoft, priority support, 250 MB uploads and all of your version history. Each seat adds 200 AI form builds, 50 AI edits, 50 responses AI works on and 10 insights reports a month.\n## Seats\nEvery member of a company is a seat, the owner included. A company of three on Pro pays $18 a month. Add a member and the next bill adds a seat; remove one and it drops. Guests invited to a single form are free and never a seat. On Free, members are free and unlimited.\n## Whose plan counts\nA form uses its company’s plan. Everyone working in a Pro company works with Pro features, whatever plan their own companies are on.\n> Features that are not on your company’s plan still show in the app, with a small Pro or Business label. Select it to see what it does and upgrade.",
        "updated": "2026-09-29",
        "related": [
          "seats",
          "billing",
          "auto-renew"
        ]
      },
      {
        "id": "seats",
        "title": "How seats are counted",
        "summary": "Who is a seat, what a seat costs, and what happens when people join or leave.",
        "body": "Paid plans are priced per seat. Every member of a company is a seat, the owner included.\n## What a seat costs\n- Pro: $6 a seat a month, or $60 a year.\n- Business: $19 a seat a month, or $190 a year.\nA company of three on Pro pays $18 a month.\n## Who is not a seat\nGuests invited to a single form are never a seat. On Free, members are not seats either: add as many as you like.\n## People joining and leaving\nAdd a member and the subscription adds a seat; remove one and it drops. Polar works out the difference for the rest of the period, so you pay for the time each seat was there.\n## Seats and the AI allowance\nEach seat adds its plan’s monthly AI allowance to the company’s shared pool, so a bigger team gets more AI to share. See AI allowance and credits.\n## Seeing the count\nSettings → Plan shows how many seats the company is billed for, and what the next renewal comes to.",
        "related": [
          "members-guests",
          "plans-overview",
          "ai-credits"
        ],
        "updated": "2026-09-30"
      },
      {
        "id": "billing",
        "title": "Upgrading and switching plans",
        "summary": "Checkout, switching between Pro and Business or monthly and yearly, and what a downgrade does.",
        "body": "Upgrade from Settings → Plan, from the Upgrade button beside Create form, or from any Pro label in the app. Only a company’s owner and its admins can change its plan. Payment is handled by Polar, who act as the merchant of record: they take the card, add any sales tax or VAT, and send the receipt.\n## Switching plans\nOn a paid plan, pick another plan, or monthly or yearly, under Settings → Plan and confirm. It changes on the same subscription: Polar credits what is left of the period and charges the difference. Yearly is two months free.\n## Seats on the bill\nThe subscription follows the company’s members. See How seats are counted.\n## If a payment does not show\nPolar tells Formkit the moment a payment goes through, and Formkit asks Polar again when you come back from checkout. If a company still shows the wrong plan, see I paid but my plan has not changed.\n## What a downgrade does\nNothing is deleted. Features outside your new plan stop: a custom domain goes back to your formkit.app link and the “Made with Formkit” badge comes back. Everything you built or collected stays yours and exportable. Upgrade again and they come back as they were.\n## Cancelling\nSee Auto-renew and cancelling.",
        "updated": "2026-09-30",
        "related": [
          "auto-renew",
          "invoices",
          "seats"
        ]
      },
      {
        "id": "auto-renew",
        "title": "Auto-renew and cancelling",
        "summary": "Turn renewal off in one click, see the day your plan ends, and change your mind until then.",
        "body": "A paid plan renews on its own until you say otherwise. Settings → Plan shows exactly what happens next: the day it renews and for how much, or the day it ends.\n## Turning auto-renew off\nSwitch Auto-renew off under Settings → Plan. The plan stays on until the end of the period you have paid for, and nothing more is charged. Then the company moves to Free.\n## Cancelling\nCancel plan does the same thing, with one confirmation that names the day it ends. There is no survey and no offer to talk you out of it.\n## Changing your mind\nUntil the period ends, switch Auto-renew back on and the plan carries on as before, renewing on the same day.\n## What happens on Free\nNothing is deleted. Features outside Free stop: a custom domain goes back to your formkit.app link, the “Made with Formkit” badge comes back, and the AI allowance drops to Free’s. Everything you built or collected stays yours and exportable.\n## Who can do this\nThe company’s owner and its admins.",
        "related": [
          "billing",
          "invoices",
          "plans-overview"
        ],
        "updated": "2026-09-30"
      },
      {
        "id": "invoices",
        "title": "Invoices, receipts and your card",
        "summary": "Where to find every receipt, and how to change the card a plan is paid with.",
        "body": "Formkit’s payments are handled by Polar, who act as the merchant of record. Receipts come from them, with any sales tax or VAT shown.\n## Opening your billing page\nSettings → Plan → Invoices and billing opens Polar’s page for the company. It lists every order and receipt, and the card on file.\n## Changing your card\nUpdate the payment method on that page. The next renewal uses the new card.\n## A receipt by email\nPolar emails a receipt for every payment to the address used at checkout.\n## Company details on an invoice\nPolar’s checkout lets you buy as a business, with your company’s name, address and tax ID.\n## Who can open it\nThe company’s owner and its admins.\n> If the button says billing could not open, try again in a moment. If it keeps failing, contact us and we will send the receipts directly.",
        "related": [
          "auto-renew",
          "billing",
          "plan-not-showing"
        ],
        "updated": "2026-09-30"
      }
    ],
    "group": "Plans and paid features"
  },
  {
    "id": "brand",
    "name": "Branding and smarter forms",
    "icon": "sparkles",
    "desc": "Pro: your own domain and sender, fonts and CSS, and forms that fill themselves in, add up and send people on.",
    "articles": [
      {
        "id": "custom-domain",
        "title": "Use your own domain",
        "summary": "Put your forms on forms.yourcompany.com.",
        "body": "Settings → Company → Custom domains. Enter a subdomain you own, like forms.acme.com. It is for the company you have open.\n## The DNS record\nFormkit shows one CNAME record to add where your domain's DNS is managed. It usually takes a few minutes, occasionally a few hours. Formkit checks every ten minutes, or select Check now.\n## What changes\nOnce it is live, share links for that company use your domain: forms.acme.com/intake. The domain's home page lists the company's open forms. Your formkit.app links keep working.\n## If the plan ends\nNothing breaks: visits to your domain are sent on to the matching formkit.app link.\n> Custom domains are part of Pro.\n## If it will not connect\nSee My custom domain is not working.",
        "updated": "2026-09-30",
        "related": [
          "domain-not-working",
          "email-domain",
          "claim-handle"
        ]
      },
      {
        "id": "email-domain",
        "title": "Send emails from your own domain",
        "summary": "Confirmation emails from hello@yourcompany.com.",
        "body": "Settings → Notifications → Send from your own domain. Enter the address and the name people should see.\n## Verifying\nFormkit shows the DNS records to add, usually a few TXT and MX records. When they are in place the domain shows as Live, and confirmation emails to the people who answer your forms come from your address.\n## Replies\nReplies still go to the reply-to address set on each form.\n> Sending from your own domain is part of Pro.",
        "updated": "2026-09-28"
      },
      {
        "id": "hidden-fields",
        "title": "Hidden fields and pre-filled answers",
        "summary": "Carry a campaign, an ID or an answer in through the link.",
        "body": "Give a question a key in its settings, say source. A link with ?source=newsletter fills that question in for the person answering.\n## Hidden fields\nAdd a Hidden field from the Smart group. People never see it, but its value is saved with the response: a campaign name, a customer ID, a referral code. Set a default value for when the link has none.\n## Pre-filling visible questions\nAny question with a key can be pre-filled the same way. The person sees the answer and can change it.\n> Hidden fields and pre-filled answers are part of Pro.",
        "updated": "2026-09-28"
      },
      {
        "id": "calculations",
        "title": "Calculations and scoring",
        "summary": "Add up answers into a total, a score or a price.",
        "body": "Give a choice question's options points in its settings, or use number, rating and scale questions as they are.\n## Writing a calculation\nIn the Logic tab, under Calculations, give it a name and a formula over question keys, like quality + value * 2, using + − × ÷, brackets, and min, max, round and abs. Each calculation can use the ones above it.\n## Using the result\nResults are worked out when the form is sent, saved with the response, shown in the inbox and exported as columns. Quote them on the thank-you screen with {{total}}, or charge the amount with payments.\n> Calculations are part of Pro.",
        "updated": "2026-09-28"
      },
      {
        "id": "piping-redirects",
        "title": "Quote answers, and send people on",
        "summary": "“Thanks {{name}}”, and a page of yours after.",
        "body": "Once a question has a key, write {{key}} in any later question, help text, page name, the welcome screen or the thank-you screen, and it is replaced with the person's answer.\n## Redirecting after\nIn Settings → Submission, a redirect address sends people straight to a page of yours when they finish. Keys work there too: https://acme.com/thanks?name={{name}}.\n> Answer piping and redirects are part of Pro.",
        "updated": "2026-09-28"
      }
    ],
    "group": "Plans and paid features"
  },
  {
    "id": "ai-business",
    "name": "AI replies, insights and quizzes",
    "icon": "sparkles",
    "desc": "Pro: a reply written for everyone who answers, what the AI reads in your responses, and quizzes and exams.",
    "articles": [
      {
        "id": "ai-replies",
        "title": "AI replies to every response",
        "summary": "A personal reply for each person who answers, on the form, by email or both.",
        "body": "Open a form's Settings → AI reply and turn on Write a reply to every response.\n## Your instructions\nTell the AI what the reply should do, as you would brief a colleague: who it is from, what to look at in their answers, what to offer. Start from an example if you like. Add background it may use: your services, prices, links, answers to common questions. It never makes these up; it only uses what you give it.\n## Where it goes\n- On the form: the reply appears on the thank-you screen as soon as it's written.\n- By email: sent to the address they gave, in place of your usual confirmation.\n- Both.\n## The email\nPlain text, or your branded template with the form's logo and colour. Set the sender name, a subject (or let the AI write one) and a signature. It comes from your own address when you've set one up under Settings → Email.\n## Try it\nWrite a sample reply to your latest response before turning it on. Nothing is sent.\n## In your responses\nEach response shows the reply, whether it was emailed and whether the person found it helpful. Edit it, send it again, or write it again if it failed.\n> AI replies are part of Pro.",
        "updated": "2026-09-29"
      },
      {
        "id": "ai-replies-allowance",
        "title": "How many responses AI works on",
        "summary": "20 a month per seat on Pro and 50 on Business, then AI credits.",
        "body": "Each seat adds responses AI works on to the company’s monthly pool: 20 on Pro, 50 on Business. It refills on the first, and Settings → Plan shows how many are left.\n## What counts\nA response counts once, whether the AI writes it a reply, reads it for AI logic, pulls facts from it, or all three.\n## Adding more\nOnce the month’s are gone, AI credits keep it going at 1 credit a response. Packs start at $5 for 100, under Settings → Plan, and last 12 months.\n## When both run out\nNew responses simply get your usual confirmation email, and you’re told once that month. Nothing breaks, and no one is left waiting.\n## Failed replies\nIf the AI can’t write a reply, it doesn’t count, and the person gets your usual confirmation instead.",
        "updated": "2026-09-29"
      },
      {
        "id": "ai-insights",
        "title": "AI insights on your responses",
        "summary": "How people feel, what they want, and which responses to follow up.",
        "body": "For forms with AI replies, the AI also reads each response for its sentiment, what the person wants, the topics it touches, a lead score out of 100 by your goal, and how urgent it is.\n## Where to see it\nA form's Analytics tab gains an AI insights section: how people feel, what comes up and how promising each topic is, the most promising responses, the ones worth a personal reply, and how the replies landed.\n## The AI's report\nSelect Write a report and the AI reads across your latest responses and says what stands out: themes, opportunities, things worth watching and what to do next.\n## In exports\nExports gain Sentiment, Lead score, Urgency, AI summary and AI reply columns.\n> AI insights are part of Pro. Each report uses one of your company’s insights reports for the month: 3 a seat on Pro, 10 on Business.",
        "updated": "2026-09-29"
      },
      {
        "id": "quizzes",
        "title": "Quizzes and exams",
        "summary": "Right answers, marks, a timer and results, shown straight away or released later.",
        "body": "Open a form's Settings → Quiz and turn on This form is a quiz.\n## Right answers and marks\nIn Build, each question gains a Quiz section. Pick the right option (or every right option on a multiple-choice question), or type accepted answers separated by |. Set what it's worth. Written answers and uploads have no key: you mark them by hand.\n## The timer\nSet a time limit and a countdown shows from the moment people start. At zero the quiz sends itself with whatever is answered. The clock is kept by Formkit, not the person's browser.\n## Fair attempts\nShuffle the questions on each page, and the options of choice questions, into each person's own order. One attempt each allows one go per device and email address.\n## Pass mark\nSet a percentage and results say Pass or Not a pass.\n> Quizzes are part of Pro.",
        "updated": "2026-09-29"
      },
      {
        "id": "quiz-results",
        "title": "Marking and releasing results",
        "summary": "Mark written answers, then show results straight away or when you're ready.",
        "body": "## Results straight away\nPeople see their mark on the thank-you screen and get a link to their results page. Turn on Show the right answers and they also see each question with the right answer.\n## Results later\nFor exams you mark first, choose Later. People are told their results are coming. Release them from Settings → Quiz with Release results now, or set a time and they go out on their own.\n## Marking by hand\nOpen a response under Responses. The Quiz section lists every question with its marks; type a mark for anything waiting, or change an automatic one. Settings → Quiz shows how many are waiting.\n## Emailing results\nTurn on Email people their results and everyone with an email answer gets a link to their results once they're out and fully marked.\n## The numbers\nSettings → Quiz shows the average, the pass rate, the spread of scores and how many got each question right. Exports gain Score, Out of, Percent, Result and To mark columns.",
        "updated": "2026-09-28"
      }
    ],
    "group": "Plans and paid features"
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
        "summary": "Every new response, as JSON, to an address of yours. Each one is signed so you know it came from Formkit.",
        "body": "Open a form's Settings → Connections and choose Webhook. Paste the address that should receive each response. Zapier's “Catch Hook” trigger and Make's “Custom webhook” module both give you one.\n## What arrives\nA POST with the form, the respondent, every answer with its question and key, the calculations and any payment. A file upload or voice recording also carries a fileUrl to download it from. The Formkit-Event header says response.created, response.paid or response.test.\n## Checking the signature\nWhen you add a webhook you are shown its secret once. Each delivery carries Formkit-Signature: t=…,v1=…, an HMAC-SHA256 of the timestamp and the body. The API page has code for checking it.\n## When a delivery fails\nFormkit tries again after a minute, then after ten. Recent deliveries, and what the other end answered, are listed under the connection. Send a test to set things up before real answers arrive.\n> Connections are part of Pro.",
        "updated": "2026-10-01"
      },
      {
        "id": "slack",
        "title": "Post new responses to Slack",
        "summary": "A short message in a channel for each response.",
        "body": "In Slack, add the Incoming Webhooks app to the channel you want and copy the address it gives you. It starts https://hooks.slack.com/services/.\nIn a form's Settings → Connections, choose Slack and paste it. Each new response posts its first few answers; a payment posts a line of its own.\n> Slack is part of Pro.",
        "updated": "2026-09-28"
      },
      {
        "id": "google-sheets",
        "title": "Keep a Google Sheet up to date",
        "summary": "A private link your sheet pulls from. Nothing to authorise.",
        "body": "In a form's Settings → Connections, choose Google Sheets. Formkit makes a private link to the form's responses.\n## The quick way\nIn any cell of a sheet, type the =IMPORTDATA(\"…\") formula shown. Google refreshes it about once an hour. Uploaded files and voice recordings arrive as links.\n## Every few minutes\nUse the Apps Script instead: Extensions → Apps Script, paste the script Formkit gives you, then add a time-driven trigger.\n## Keep it private\nAnyone with the link can read the responses. If it gets out, make a new link and the old one stops working at once.\n> Google Sheets is part of Pro.",
        "updated": "2026-10-01"
      },
      {
        "id": "payments",
        "title": "Take a payment with a form",
        "summary": "People pay through your own Stripe account after they send the form.",
        "body": "Formkit never holds the money: payments go straight to your Stripe account, and Formkit takes no cut.\n## Connect Stripe\nIn Stripe, open Developers → API keys → Create restricted key. Give it Write access to Checkout Sessions and nothing else. Paste it in a form's Settings → Payments. A test key (rk_test_…) lets you try it without real money.\n## Set the amount\nCharge a fixed amount, or the result of one of the form's calculations, such as a quote that adds up the options someone picked.\n## What people see\nAfter sending the form they go to Stripe's checkout, then back to a page confirming the payment. Their answers are saved first, so a closed tab never loses them.\n## In your responses\nEach response shows Paid, Awaiting payment or Not paid, and exports gain a Payment column. Refunds are made in Stripe.\n> Payments are part of Pro.",
        "updated": "2026-09-28"
      }
    ],
    "group": "Plans and paid features"
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
        "body": "Settings → Account holds your name, your email address and your password. The name is what collaborators see on invitations and comments.\n## Your account and your companies\nYour account is you. Your forms live in companies: everyone has a personal company, and can make more from the company menu beside the logo. Plans belong to companies, not to your account, so one account can be on Free in one company and on Business in another.\n## Language\nFormkit forms are English (US) only for now.\n## Signing out\nSign out from the account menu in the top right.",
        "updated": "2026-09-29"
      },
      {
        "id": "data",
        "title": "Data, retention and deletion",
        "summary": "What Formkit stores, and how to get rid of it.",
        "body": "## What is stored\nResponses, uploaded files, the forms themselves and the email log of everything Formkit has sent on your behalf.\n## Deleting responses\nDelete individual responses from the drawer, or in bulk from the responses table. Deletion is immediate and permanent. There is no bin to restore from.\n## Deleting a form\nDeleting a form deletes its responses with it. The confirmation says how many you are about to lose.\n## Deleting your account\nSettings → Account → Delete account removes your account, your forms, your responses and your uploaded files. Type the confirmation phrase and it cannot be undone.\n> Read the privacy notice for the full picture of what is held and for how long.\n## Automatic deletion (Business)\nOn Business, Settings → Controls → Data retention erases responses, and the files uploaded with them, once they reach an age you choose, from 30 days to two years. It runs every hour and cannot be undone, so export first if you need a copy.\n## Who did what (Business)\nBusiness accounts also get an audit log of publishing, team changes, API keys and sign-in rules, kept for a year.",
        "updated": "2026-09-28"
      },
      {
        "id": "spam",
        "title": "Spam protection",
        "summary": "Keeping bots out of a public form.",
        "body": "Public forms attract automated submissions. Formkit applies two defences, both in form settings.\n## Spam check\nAn invisible check on submission. Genuine respondents never see it; obvious bots are refused. It is on by default for published forms.\n## Rate limiting\nCaps how many submissions can arrive from the same source in a short window. A form linked from a newsletter will never touch the cap; a form being hammered will.\n## If something slips through\nDelete it from the responses table and note the pattern, such as a repeated address or a nonsense answer in the same field, so you can filter for it next time.",
        "updated": "2026-09-28"
      }
    ],
    "group": "Account and troubleshooting"
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
        "body": "- The form has no questions. A welcome screen on its own is not publishable.\n- A logic rule points at a question that has been deleted. Open the Logic tab; the broken rule is flagged, and deleting or repointing it clears the block.\n- You are in support view. If the dark banner is across the top of the screen, somebody is viewing your account read-only and every change is refused. Close the banner to leave it.\n## Still stuck\nCheck the publish modal itself. It lists what is missing above the confirm button rather than failing silently.",
        "updated": "2026-09-22"
      },
      {
        "id": "no-responses",
        "title": "Responses are not arriving",
        "summary": "Work through this in order.",
        "body": "## Is the form published?\nA draft link does not accept answers. The builder header shows the state.\n## Is it closed?\nA closed form shows your closing message instead of the questions. Reopen it from the same menu.\n## Are you looking at the right filter?\nThe responses table remembers its filter. Set it to All.\n## Is the email notification on?\nAnswers can be arriving while the alert is off. Check the inbox before assuming the form is broken.\n## Did the link change?\nClaiming a handle or editing the slug changes the public URL, and anyone holding the old link gets nothing. Re-share the current link from the Share modal.",
        "updated": "2026-09-22"
      },
      {
        "id": "embed-blank",
        "title": "My embed shows nothing",
        "summary": "A blank iframe almost always means one of three things.",
        "body": "- The form is not published. An embed of a draft renders empty.\n- The snippet was pasted into a rich-text editor that strips iframes and script tags. Paste it into a raw HTML or custom code block instead.\n- The container has no height. An inline embed fills its parent; if the parent is zero pixels tall, so is the form.\n## Testing it\nOpen the public link directly in a browser. If the form loads there, the problem is the page it is embedded in, not the form.",
        "updated": "2026-09-22"
      },
      {
        "id": "cannot-open",
        "title": "Someone cannot open my form",
        "summary": "What respondents see when something is wrong on your side.",
        "body": "## \"This form is not available\"\nThe form is a draft, or it has been unpublished. Publish it and the link works again.\n## The closing message\nThe form is closed. Reopen it to take answers again.\n## A page that does not load at all\nThe link is wrong. Compare it against the link in the Share modal, character for character. A changed handle or slug is the usual cause.\n## It works for you but not for them\nYou are signed in and they are not. Open the public link in a private window to see exactly what a respondent sees.",
        "updated": "2026-09-28"
      },
      {
        "id": "plan-not-showing",
        "title": "I paid but my plan has not changed",
        "summary": "What to check when a payment went through and the app still shows the old plan.",
        "body": "Polar tells Formkit the moment a payment goes through, so a new plan usually shows within seconds of returning from checkout.\n## Check with Polar\nOpen Settings → Plan and select Check with Polar. Formkit asks Polar directly and applies whatever it finds.\n## Is it the right company?\nPlans belong to companies. If you paid while another company was open, the plan is on that one. Check with Polar says so when it finds a plan on another company; switch company with the menu beside the logo to see it.\n## Still on the old plan\nIf you were charged and nothing shows, contact us with the email you paid with. We will match the payment and put it right.",
        "related": [
          "billing",
          "invoices",
          "add-company"
        ],
        "updated": "2026-09-30"
      },
      {
        "id": "domain-not-working",
        "title": "My custom domain is not working",
        "summary": "The usual reasons a domain stays on Waiting for DNS, and how to fix each one.",
        "body": "Settings → Company → Custom domains shows each domain’s state, the exact record to add, and what public DNS shows right now. Select Check again after any change.\n## You typed the whole domain in Host\nMost DNS providers add your domain for you. For forms.acme.com, type only forms in the Host or Name field, not forms.acme.com.\n## There is already a record with that name\nA name can have only one CNAME, and a CNAME cannot sit next to an A record. Delete or edit the old record.\n## Your DNS is on Cloudflare\nSet the record to DNS only (the grey cloud). The orange proxy hides the record from Formkit.\n## You changed nameservers recently\nAdd the record where the domain’s nameservers point now, not at your old host. The setup guide shows the current nameservers.\n## It has been more than a day\nRemove the domain, add it again, and check the record matches exactly. If it still will not connect, contact us.\n## It worked, then stopped\nIf the company moved to Free, visits to your domain go on to the matching formkit.app link. Custom domains are part of Pro.",
        "related": [
          "custom-domain",
          "email-domain",
          "cannot-open"
        ],
        "updated": "2026-09-30"
      }
    ],
    "group": "Account and troubleshooting"
  }
];

export const HELP_ARTICLES: (HelpArticle & { category: HelpCategory })[] =
  HELP_CATEGORIES.flatMap((category) =>
    category.articles.map((a) => ({ ...a, category })),
  );

export function helpArticle(id: string) {
  return HELP_ARTICLES.find((a) => a.id === id) ?? null;
}
