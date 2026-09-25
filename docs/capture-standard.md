# Capture standard

One page for whoever films or photographs a No Nonsense night: camera op, VJ, or phone shooter. What goes on the site follows this.

## Before doors
- **Check the floor rule on the event.** If `door.floor` in `data/events.json` says phone-free, nobody films the crowd. Booth and stage shots only, and only with the artist's OK.
- **Consent sign at the door:** "We film the booth and wide shots of the room. Tell the door if you don't want to appear." Faces from anyone who asks go.
- **Location off.** Phones: camera location setting off. Cameras: GPS off.

## Where people stand
| Role | Position | Off limits |
|---|---|---|
| Camera 1 | Locked off, facing the booth | Crowd close-ups |
| Camera 2 | Wide, back of room or elevated | Bar, bathrooms, entrance line |
| Phone (vertical) | Roams, one per night | Anyone who waves it off |

## Settings
- 4K30 for recaps, plus 1080p60 for slow-motion drops. Flat or log profile.
- Audio: a record feed from the mixer, plus one ambient mic for crowd sound. Never phone audio alone.
- Name files `YYYY-MM-DD_event_cam1.mov`, `…_cam2`, `…_phone`.

## Delivery
- Hand files back within **48 hours**.
- Edit: a 60–90 s recap in 16:9 plus a 9:16 cut from the same timeline. Grade to the house look (amber and rose, deep blacks).
- **Captions:** auto-generate, then correct them by hand. Add sound cues like `[bass drop]`. Upload the caption file with the video.
- Blur faces in wide crowd shots unless the person agreed.

## Publishing
1. Upload to youtube.com/@NoNonsensePHL.
2. Add the video to the event in `data/events.json`:
   `"videos": [ { "youtube": "VIDEO_ID", "title": "Recap" } ]`
3. Stills and flyers: strip metadata before they go in `media/` (`exiftool -all= file.jpg`, or export as WebP without metadata).
4. Run `node tools/build.mjs --check`. It fails if any image in `media/` still carries EXIF data, which is where GPS lives.
