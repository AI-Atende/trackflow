# Future considerations

Notes parked for later review — not implemented, not scheduled.

## Automating Meta ad-creative edits (skip the manual redirect step)

Context: the "anúncio → WhatsApp direto" flow (mapping campaign/adset/ad, generating +
validating a tracked message, then having the user paste it into the ad's config in Meta Ads
Manager) currently ends with a manual redirect — the user copies the validated message and
pastes it themselves into the ad's pre-filled-message field.

It's technically possible to skip that: the pre-filled message for a Click-to-WhatsApp ad is
part of the `AdCreative` object (its call-to-action config), editable via the Marketing API
with the `ads_management` permission. Before automating this, resolve:

- **Delivery/learning-phase impact**: editing the creative of an ad that's already delivering
  can reset its learning phase or trigger a new ad review. Confirm current Meta behavior here
  before writing to a live ad automatically — a client might not expect an active campaign to
  be touched without their awareness.
- **Permission/App Review**: `ads_management` at production scale requires Meta App Review,
  the same gate as `ctwaclid` — worth bundling into the same review submission rather than a
  separate one.
- **Failure handling**: unlike the manual flow (user confirms the paste worked, in Ads
  Manager's own UI), an automated write needs its own verification that the field actually
  saved as expected before considering the ad "linked".

Until these are checked, keep the manual copy/paste/redirect flow as the only path.
