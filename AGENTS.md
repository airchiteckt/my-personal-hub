# Project Architecture Rules

- Calendar scale is driven by one persisted focus value with semantic snap points, because temporal detail and visible range must remain synchronized across controls and gestures.
- Month and year calendar overviews summarize the same task, appointment, external-calendar, and reminder sources as the timeline, because integrated calendars are first-class agenda data.
- Private attachment previews and downloads use short-lived signed storage URLs, because files must never be exposed through public object URLs.
