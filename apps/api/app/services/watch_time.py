from datetime import datetime

# The player saves the position every 5 seconds; a jump beyond this between two saves is a seek,
# not playback.
MAX_PLAYED_SECONDS = 30.0
# Room for playback faster than real time (up to 2x) and saves that arrive a little late.
MAX_SPEED = 2.5


def played_seconds(
    previous_position: float, previous_at: datetime, position: float, now: datetime
) -> float | None:
    """Seconds of video played between two saves of the position, or None when the move is not
    playback: going back, staying still or jumping further than the time that passed allows."""
    played = position - previous_position
    elapsed = (now - previous_at).total_seconds()
    if played <= 0 or played > min(elapsed * MAX_SPEED, MAX_PLAYED_SECONDS):
        return None
    return played
