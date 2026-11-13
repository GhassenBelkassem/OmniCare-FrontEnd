# G3-CAL-FIX-2 — Browser test round 1 fixes (9 items)

**Repository:** `omniCareDash`.

**Source:** `claude/OmniCare_G3_Calendar_Final_Fix_List.md` section A, items 1–9 (CTO screenshots 2026-11-13 16:05), canvas v3.3.

**Rules followed:**
- No git command was used.
- Every changed file is inside `src/app/features/doctor/calendar/`. No shared file, vendor theme, `angular.json` or backend file was touched.
- No value from the API is recomputed. Level, load, counts and slot states are shown as received; the new rules only decide how things are displayed.
- Dates go through `calendar-time.ts` and its adapter.
- Fixes already confirmed in the browser were not reopened.

## 1. The fixes: cause, change, test

### Fix 1: the month preview was see-through on past days

**Cause.** The fade (`opacity: 0.6` / `0.5`) was set on the cell element. The hover preview is a child of that cell, so it inherited the transparency.

**Change.** The cell element is never faded.
- Its level colour and border are drawn by a background layer (`::before`).
- That layer and the day's own content (number, « Fermé / Congé », dots, bar) read `opacity: var(--cal-fade)`.
- The preview, the « ⋯ » button and the day menu do not read it, so they stay fully opaque.

**Test.** Month spec: the past cell contains the preview, and the compiled CSS confirms three things:
- the fade is only a variable on `--past` and `--outside`;
- only `::before` reads it;
- no `opacity` is set on the cell or the preview.

### Fix 2: inconsistent fading in the month

**Cause.** Two class mechanisms were mixed on one element: a `[class]` string carrying the level, plus three separate `[class.…]` bindings for outside, past and today. The fade itself was element opacity (see fix 1). I could not reproduce the exact screenshot in tests. The rule is now set in one place.

**Change.** `monthCellClass(level, outside, past, today)` builds one class string per cell:
- every cell gets its level colour;
- out-of-month cells get `--outside` (50 %), past or not;
- past cells of the month get `--past` (60 %);
- today and future cells are not faded.

**Test.** Month spec checks 26 Oct and 1 Dec (out of month), 16 Nov (past), 18 Nov (today) and 20 Nov (future), plus unit cases of `monthCellClass`.

### Fix 3: thick outline on Jour / Semaine / Mois after a mouse click

**Cause.** NG-ZORRO's segmented control focuses a hidden radio input on click, and it stops that click from bubbling up. The CAL-FIX guard was CSS-only and the switch-only blur did not cover it. The next key press then drew the keyboard ring.

**Change.** `CalendarView` listens to clicks in the capture phase, so the stopped click is still heard.
- After a mouse or touch click (`detail > 0`), these give their focus back: buttons, radios, checkboxes, month cells, switches.
- Text fields, the date picker, dialogs, menus, open popups and popconfirms keep their focus.
- Keyboard activation (`detail === 0`) keeps the focus.
- The keyboard ring of the segmented control is drawn on the option, only for `:focus-visible`.

**Test.** Page spec: a mouse click on the Jour/Semaine/Mois radio gives the focus back, and a keyboard click keeps it. `shouldReleaseFocus` is checked for each element kind.

### Fix 4: the month search hint was wrapped text under the field

**Change.**
- The disabled field's placeholder now carries the hint.
- So does its `title`, also set on the wrapper because some browsers show no tooltip on a disabled field.
- The text line under the field (and its CSS) is gone, so nothing moves.
- The screen-reader description is unchanged.

**Test.** Month-page spec, existing test adapted: placeholder, both titles and no `.cal-search__hint`. In week view the normal placeholder returns and the titles are removed.

### Fix 5: the week grid started at 09h although the hours start at 07:00

**Cause, found in the code (not seen in the browser).**
- The API sends `LocalTime` as « HH:mm:ss » (Spring/Jackson `LocalTime`, e.g. `07:00:00`), but `minutesOfDay` only accepted « HH:mm ».
- Every rule window was dropped, so the grid fell back to its 08:00 – 18:00 default; FullCalendar does not print the first hour label at the top edge, so the grid seemed to start at 09h.
- The same parser feeds `isWorkingTime`, so a click on a 07:30 slot was also answered « en dehors de vos horaires ».

**Change.**
- `minutesOfDay` accepts « HH:mm », « HH:mm:ss » and « HH:mm:ss.SSS ».
- `paddedSlotBounds` also takes the loaded appointments and requests of the visible period. They only widen the grid (a 07:30 appointment stays visible when the hours start at 09:00); without any rule the 08:00 – 18:00 default stays.
- The bounds compare by value, so a reload with the same bounds does not rebuild the FullCalendar options.
- `slotMinTime` and `scrollTime` both use the result, so the grid opens there.

**Test.**
- Time-adapter spec: `07:00:00` opens the grid at 06:00 and counts as working time; a 07:30 appointment widens a 09:00 schedule.
- Page spec: `slotMinTime` and `scrollTime` both read `06:00:00`.

### Fix 6: past time was offered for booking

**Change.**
- **Month cells** keep their level colour, faded (fix 2).
- **Level chip.** In the month preview and the day header, a past day reads « Passé » on neutral grey. A closed past day keeps « Fermé ».
- **Month preview** of a past day has no « + Rendez-vous ». « Ouvrir la journée » stays.
- **Timelines** (month preview and day view): a grey layer covers the time before now. It covers the whole day once the day is over and nothing on a future day. Today, it ends at now (`pastTimelinePercent`).
- **Entry points:**
  - the month's `newAppointment` ignores a past day;
  - the page's `NEW_APPOINTMENT_ON` ignores a past day, and for today it opens the drawer without a pre-filled time when the opening hour is already past;
  - `DAY_ADD_SLOT` ignores a start before now;
  - day rows already showed only FREE slots (the API's state);
  - the week click already refused past slots.

**Test.**
- Month spec: past day (« Passé », only « Ouvrir la journée », grey 100 %, cell keeps its level, `newAppointment` emits nothing); today at 10:00 (chip kept, « + Rendez-vous », grey 20 %); future day (no grey, chip, « + Rendez-vous »).
- Day spec: past day (« Passé », grey 100 %, no « + Ajouter », no new-appointment card); today at 10:20 (chip kept, grey 140/600); future day (no grey, « Chargé »); closed past day (« Fermé »).
- Page spec: past day and past start are refused, a future start is accepted.

### Fix 7: « Aucun rendez-vous ce jour » showed above free rows

**Change.** `emptyDayText(n)` gives:
- « Aucun rendez-vous · n créneaux libres » (« 1 créneau libre » in the singular) when the API lists free slots;
- « Aucun rendez-vous ce jour » only when there is no appointment and no free slot.

**Test.** Day spec covers plural, singular and none. Two existing assertions (day spec, day-page spec) were updated to the new text.

### Fix 8: « Nouveau rendez-vous » card in the day view

**Change.** The aside gets the canvas card: white, 1 px #1FBF9A border.
- It shows « Nouveau rendez-vous » and « Premier créneau libre : HH:mm ». The slot is the first FREE slot of day-slots, as the API states it.
- « Choisir le patient » emits `DAY_ADD_SLOT`, which opens the existing QuickBookingDrawer on that slot.
- There is no type or duration choice (parked).
- The card is hidden on a past day and when there is no free slot.

**Test.** Day spec: the card text, the action on click, hidden with no FREE slot, hidden on a past day. « Patient suivant · dans 40 min » appears with a future confirmed appointment (fixture at 11:00, now 10:20).

### Fix 9: the week lunch block looked smaller than the canvas

**Cause.** The break content is a flex item of the theme's event box, like the cards in CAL-FIX fix 4, so it shrank to its text.

**Change.** The content stretches to fill the block, with the canvas values:
- block #F2F4F7 with a 1 px #E4E7EC border;
- a 24 px white circle with a soft shadow;
- icon and label in #475467, label at 13 px, reading « Pause déjeuner · 11:00 – 12:00 ».

**Test.** Not testable in jsdom (no layout). It is in the browser checklist.

**Existing assertions changed on purpose (6):**
- the month preview of 16 Nov now reads « Passé » (it is before the spec's today);
- the « + Rendez-vous » test moved to a future day (23 Nov);
- the two « Aucun rendez-vous ce jour » tests (fix 7);
- the month-page search hint test (fix 4).

## 2. Test results

| Run | Result |
|---|---|
| Calendar, scheduled-care, routes and appointment-status specs before (CAL-FIX) | 27 files, 675 tests |
| Same selection after | **27 files, 695 tests, all pass** (+20) |
| Forced zones New York, Tokyo, UTC (CAL-T method, zone probe deleted afterwards) | **28 files, 696 tests (695 + probe), all pass in each zone** |
| `tsc --noEmit -p tsconfig.app.json` | clean |
| Production build | OK |
| Static-demo build | OK |
| `npm run check:ui-boundaries` | passes (all four checks) |

### Budgets vs CAL-FIX (report only)

| Budget | CAL-FIX | CAL-FIX-2 |
|---|---|---|
| Initial bundle (production) | 993.66 kB (warning at 750 kB) | 993.69 kB (+0.03 kB) |
| waiting-room static-demo scss | over by 955 bytes | unchanged |
| Calendar lazy chunk (production) | 551.52 kB | 557.04 kB (+5.52 kB) |
| Static-demo calendar chunk | 467.24 kB | 472.26 kB (+5.02 kB) |

No new warning.

## 3. Things worth knowing

- **Fix 5 also fixes working-time checks.** With « HH:mm:ss » rules, `isWorkingTime` and `fullyBlockedDateKeys` read no time at all. A click on a working slot could therefore answer « en dehors de vos horaires », and a fully blocked day was not marked. Both now read the API format. Please check a booking click at 07:30 in the browser.
- **The new focus rule (fix 3) covers every control of the calendar**, not only the segmented control. Text fields, the date picker, dialogs, menus and confirmations are excluded. Keyboard users see no difference.
- **No recomputation.** « Passé », the grey past layer and the « no booking on past time » guards compare dates and times only. Level, load, counts and slot states still come from the API as received. Day rows still list only the slots the API says are FREE.

## 4. Browser checklist (these 9 items)

1. Month: hover a past day and a day of the previous month. The preview card is fully opaque.
2. Month: the out-of-month days (both ends) are equally faded and keep their colour. Past days of the month are a little less faded. Today and future days are not faded.
3. Click Jour, Semaine, Mois, ← → and a month cell with the mouse, then press an arrow key: no thick ring anywhere. Tab with the keyboard: the ring shows.
4. Month: the search field is greyed with « La recherche fonctionne en vue Jour et Semaine » inside it and as a tooltip. No text under it, and nothing moves when switching views.
5. Week with hours from 07:00: the grid starts at 06:00. A 07:30 appointment is visible. A click at 07:30 on a free slot opens the booking drawer, without the « en dehors de vos horaires » toast.
6. Past day, today and a future day, in the month preview and the day view:
   - past day: « Passé » in grey, no « + Rendez-vous », grey timeline;
   - today: grey only up to now;
   - future day: no grey.

   Neither « + Ajouter » nor « + Rendez-vous » is ever offered on past time.
7. Day without appointments: « Aucun rendez-vous · n créneaux libres » with the free rows. A day with nothing at all: « Aucun rendez-vous ce jour ».
8. Day view, today or a future day with free time: the « Nouveau rendez-vous » card shows the first free slot, and « Choisir le patient » opens the drawer on it. It does not show on a past day or a full day. « Patient suivant » shows with an upcoming confirmed appointment.
9. Week lunch break: a full-width grey block with a white round cup icon and « Pause déjeuner · 11:00 – 12:00 » in 13 px.

## 5. Path to deliver G-3

| Step | Status | Missing |
|---|---|---|
| CAL-1 … CAL-6, CAL-T, CAL-FIX | built and tested; CAL-FIX partly confirmed in the browser | the remaining lines of the CAL-FIX checklist |
| CAL-FIX-2 (this report) | done: 9 of 9 applied | browser check of the 9 lines above, especially 2, 5 and 9 (layout and real API times) |
| Browser test round 2 | **next** | the CTO's pass on the whole calendar after this round |
| Global popover styles | parked | when a second screen needs nz-popover, with a budget decision |
| Test builder (`isolate`) | parked | to remove the CAL-4 / CAL-5 workarounds (outside `calendar/`) |
| Booking card type and duration | parked | backend support |
| Parked backend items | parked | `practicePatientId` in the agenda item; Déplacer / Message / Marquer absent |
| Initial bundle | handled separately | 993.69 kB against the 750 kB warning (≈ 6 kB below the 1 MB error budget) |

G-3's « Done when » for the calendar is met in code. The remaining step is the CTO's browser confirmation.
