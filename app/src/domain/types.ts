/** The shape of one event. Mirrors the legacy app's state exactly, so the two can be
 *  compared number-for-number during the port. */

export type PlayerId = string;
export type GameId = string;
export type RoundId = string;
export type RelayId = string;
export type TeamKey = "A" | "B";

export interface Player { id: PlayerId; name: string }
export interface Game { id: GameId; name: string }

export interface TeamSide { name: string; members: PlayerId[] }
export interface Teams { drawn: boolean; A: TeamSide; B: TeamSide }

/** scores[playerId][gameId] = seconds. Missing or null means "not recorded". */
export interface Round {
  id: RoundId;
  label: string;
  scores: Record<PlayerId, Record<GameId, number | null | undefined> | undefined>;
  /**
   * A total recorded WITHOUT station splits. Some rounds only ever existed as a final
   * time -- 2025's first two pentathlons were kept that way. Storing the total lets
   * those rounds count towards averages and standings while staying correctly absent
   * from anything station-level.
   */
  totals?: Record<PlayerId, number | null>;
}

export interface RelayEntry {
  lineup: (PlayerId | null)[];
  splits: (number | null)[];
}

export interface Relay {
  id: RelayId;
  label: string;
  legs: GameId[];
  entries: Record<TeamKey, RelayEntry>;
}

export interface EventState {
  players: Player[];
  games: Game[];
  teams: Teams;
  rounds: Round[];
  relays: Relay[];
}
