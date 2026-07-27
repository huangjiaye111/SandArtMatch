# UI Flow

## Navigation

Frozen:

- Battle flow must support pause, failure, and victory.
- Battle back action opens pause instead of immediately exiting.
- Victory and failure must not appear at the same time.

待验证:

- Full app navigation tree.
- Whether MVP starts from Home, Level Select, or directly from a test Battle scene.

## Proposed Page Flow

待验证:

```text

Boot
-> Home
-> Battle
   -> Pause Popup
   -> Fail Popup
   -> Win Popup

```

Post-MVP references:

- Collection.
- Sign-in.
- Shop.
- Daily challenge.
- Activity pages.

## Modal Priority

可配置:

- Privacy authorization.
- System error.
- Network conflict.
- Win.
- Fail.
- Revive.
- Purchase confirmation.
- Tool explanation.
- Toast.

待验证:

- Whether privacy and network flows are part of the first MVP.
- Exact priority order between revive and failure follow-up actions.

## Popup Rules

Frozen:

- Win and failure cannot be shown simultaneously.

可配置:

- Whether popup background blur is enabled.
- Whether close buttons are available on each popup.
- Popup animation duration.

待验证:

- Whether revive is present in MVP.
- Whether restart always requires confirmation.
